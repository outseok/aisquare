import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as getCFSignedUrl } from '@aws-sdk/cloudfront-signer';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import * as crypto from 'crypto';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'video/mp4',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'image/svg+xml',
];
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly s3: S3Client;
  private readonly lambda: LambdaClient;
  private readonly bucket = process.env.AWS_S3_BUCKET!;
  private readonly cfDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
  private readonly cfKeyPairId = process.env.AWS_CLOUDFRONT_KEY_PAIR_ID;
  private readonly cfPrivateKey = process.env.AWS_CLOUDFRONT_PRIVATE_KEY
    ? (() => {
        const pem = Buffer.from(process.env.AWS_CLOUDFRONT_PRIVATE_KEY!, 'base64').toString('utf-8');
        try {
          // Node 18+ (OpenSSL 3)에서 PKCS#1 키를 PKCS#8로 변환
          const keyObj = crypto.createPrivateKey(pem);
          return keyObj.export({ type: 'pkcs8', format: 'pem' }) as string;
        } catch {
          return pem;
        }
      })()
    : undefined;
  private readonly clamavLambdaArn = process.env.AWS_CLAMAV_LAMBDA_ARN;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.lambda = new LambdaClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('파일 크기는 500MB를 초과할 수 없습니다');
    }

    const ext = file.originalname.split('.').pop();
    const key = `uploads/${uuidv4()}.${ext}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256',
      }),
    );

    // ClamAV 바이러스 검사: Lambda 호출 후 감염 파일은 S3에서 삭제
    await this.scanWithClamAV(key);

    return key;
  }

  private async scanWithClamAV(key: string): Promise<void> {
    if (!this.clamavLambdaArn) {
      this.logger.warn('AWS_CLAMAV_LAMBDA_ARN not set, skipping virus scan');
      return;
    }

    let scanResult: { status: string; infected?: boolean; viruses?: string[] };

    try {
      const payload = JSON.stringify({ bucket: this.bucket, key });
      const response = await this.lambda.send(
        new InvokeCommand({
          FunctionName: this.clamavLambdaArn,
          Payload: Buffer.from(payload),
        }),
      );

      const raw = response.Payload ? Buffer.from(response.Payload).toString('utf-8') : '{}';
      scanResult = JSON.parse(raw);
    } catch (err) {
      // Lambda 호출 실패 시 업로드된 파일 삭제 후 예외 처리
      this.logger.error('ClamAV Lambda invocation failed', err?.message);
      await this.deleteFile(key);
      throw new BadRequestException('바이러스 검사 중 오류가 발생했습니다. 파일 업로드가 취소되었습니다.');
    }

    if (scanResult.infected) {
      await this.deleteFile(key);
      const detected = scanResult.viruses?.join(', ') || '알 수 없는 위협';
      this.logger.warn(`Infected file detected and removed: ${key} (${detected})`);
      throw new BadRequestException(`바이러스가 감지되었습니다: ${detected}`);
    }
  }

  private async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.logger.error(`Failed to delete file from S3: ${key}`, err?.message);
    }
  }

  async getPresignedDownloadUrl(key: string, expiresIn = 300): Promise<string> {
    // CloudFront Presigned URL 우선 사용, 설정 없으면 S3 Presigned URL fallback
    if (this.cfDomain && this.cfKeyPairId && this.cfPrivateKey) {
      return this.getCloudFrontSignedUrl(key, expiresIn);
    }
    return this.getS3PresignedUrl(key, expiresIn);
  }

  private getCloudFrontSignedUrl(key: string, expiresIn: number): string {
    const url = `https://${this.cfDomain}/${key}`;
    const dateLessThan = new Date(Date.now() + expiresIn * 1000).toISOString();

    return getCFSignedUrl({
      url,
      keyPairId: this.cfKeyPairId!,
      privateKey: this.cfPrivateKey!,
      dateLessThan,
    });
  }

  private async getS3PresignedUrl(key: string, expiresIn: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: 'attachment',
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<{ uploadUrl: string; key: string }> {
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다');
    }

    const ext = filename.split('.').pop();
    const key = `uploads/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn });
    return { uploadUrl, key };
  }

  async checkUrlSafety(url: string): Promise<{ safe: boolean; threat?: string }> {
    const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
    if (!apiKey) {
      this.logger.warn('GOOGLE_SAFE_BROWSING_API_KEY not set, skipping safety check');
      return { safe: true };
    }

    try {
      const response = await axios.post(
        `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
        {
          client: { clientId: 'recode-ai', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        },
        { timeout: 5000 },
      );

      const matches = response.data?.matches;
      if (matches && matches.length > 0) {
        return { safe: false, threat: matches[0].threatType };
      }
      return { safe: true };
    } catch (err) {
      this.logger.error('Safe Browsing API error', err?.message);
      return { safe: true };
    }
  }

  async scanContentUrls(content: string): Promise<void> {
    const urlRegex = /https?:\/\/[^\s"'<>]+/g;
    const urls = content.match(urlRegex) || [];

    await Promise.all(
      urls.map(async (url) => {
        const result = await this.checkUrlSafety(url);
        if (!result.safe) {
          throw new BadRequestException(`위험한 링크가 포함되어 있습니다: ${result.threat}`);
        }
      }),
    );
  }
}

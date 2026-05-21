import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmTossPaymentDto } from './dto/confirm-toss-payment.dto';
import { ConfirmSquarePaymentDto } from './dto/confirm-square-payment.dto';
import { ProductsService } from '../products/products.service';
import { FilesService } from '../files/files.service';
import { TokenService } from '../token/token.service';
import { FabricService } from '../fabric/fabric.service';

// ── 시드/데모 상품용 더미 파일 생성기 ──
// fileType별로 해당 확장자에 맞는 최소 유효 바이너리를 만들어 클라이언트가 적절한 확장자로 저장할 수 있게.
function buildDummyFile(fileType: string, product: any, orderId: string): { buf: Buffer; contentType: string; ext: string } {
  const meta = [
    `AISquare Demo`,
    `Product: ${product.id}`,
    `Order: ${orderId}`,
    `Type: ${fileType}`,
  ].join(' | ');

  switch ((fileType || '').toUpperCase()) {
    case 'PDF': {
      // 한 페이지짜리 최소 유효 PDF + 영문 상품 제목 텍스트 stream (한글은 폰트 임베드 없이 깨지므로 영문/식별자 위주)
      const title = String(product.id || 'AISquare').replace(/[()\\]/g, '');
      const stream =
        `BT /F1 14 Tf 50 760 Td (AISquare Demo Document) Tj ` +
        `0 -28 Td /F1 11 Tf (Product: ${title}) Tj ` +
        `0 -18 Td (Order: ${orderId}) Tj ` +
        `0 -18 Td (Type: ${fileType}) Tj ` +
        `0 -28 Td (This is a placeholder file for the seed demo product.) Tj ` +
        `0 -16 Td (Real seller-uploaded products are served from S3.) Tj ET`;
      const objs = [
        '%PDF-1.4',
        '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
        '3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 5 0 R>>>>/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj',
        `4 0 obj<</Length ${Buffer.byteLength(stream)}>>stream\n${stream}\nendstream\nendobj`,
        '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
      ];
      const body = objs.join('\n') + '\n';
      // xref / trailer
      let xref = 'xref\n0 6\n0000000000 65535 f \n';
      let offset = 0;
      const lines = body.split('\n');
      for (let i = 1; i <= 5; i++) {
        let n = 0;
        for (const line of lines) {
          if (line.startsWith(`${i} 0 obj`)) break;
          n += line.length + 1;
        }
        offset = n;
        xref += String(offset).padStart(10, '0') + ' 00000 n \n';
      }
      const trailer = `trailer<</Size 6/Root 1 0 R>>\nstartxref\n${body.length}\n%%EOF`;
      return { buf: Buffer.from(body + xref + trailer, 'binary'), contentType: 'application/pdf', ext: 'pdf' };
    }
    case 'PNG': {
      // 검증된 최소 PNG (1x1 회색) — base64로 임포트해서 헥스 오류 방지
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWNgIA0AAAAxAAGCpRpVAAAAAElFTkSuQmCC',
        'base64');
      return { buf: png, contentType: 'image/png', ext: 'png' };
    }
    case 'JPG':
    case 'JPEG': {
      // 1x1 white JPEG (valid minimal)
      const jpg = Buffer.from(
        'FFD8FFE000104A46494600010100000100010000FFDB0043000302020302020303030304030304050805050404050A070706080C0A0C0C0B0A0B0B0D0E12100D0E110E0B0B1016101113141515150C0F171816141812141514FFDB00430103040405040509050509140D0B0D14141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414141414FFC00011080001000103012200021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE1E2E3E4E5E6E7E8E9EAF1F2F3F4F5F6F7F8F9FAFFC4001F0100030101010101010101010000000000000102030405060708090A0BFFC400B511000201020404030407050404000102770001020311043105213141061271811432A1B1C109233352F0156272D10A162434E125F11718191A262728292A35363738393A434445464748494A535455565758595A636465666768696A737475767778797A82838485868788898A92939495969798999AA2A3A4A5A6A7A8A9AAB2B3B4B5B6B7B8B9BAC2C3C4C5C6C7C8C9CAD2D3D4D5D6D7D8D9DAE2E3E4E5E6E7E8E9EAF2F3F4F5F6F7F8F9FAFFDA000C03010002110311003F00FBD3FFD9',
        'hex');
      return { buf: jpg, contentType: 'image/jpeg', ext: 'jpg' };
    }
    case 'MP4': {
      // ISO BMFF 최소 ftyp box (24 bytes) + free 박스. 미디어 데이터는 없으나 형식상 유효.
      const ftyp = Buffer.from(
        '0000001866747970697368696D000000006D6D70343269736F6D' +
        '00000008667265650000000800006D646174', 'hex');
      return { buf: ftyp, contentType: 'video/mp4', ext: 'mp4' };
    }
    case 'ZIP': {
      // empty ZIP (PK\x05\x06 EOCD only)
      const zip = Buffer.from('504B0506000000000000000000000000000000000000', 'hex');
      return { buf: zip, contentType: 'application/zip', ext: 'zip' };
    }
    case 'TXT':
    default: {
      const body = [
        '═══════════════════════════════════════════════',
        `  AISquare — ${product.title || product.id}`,
        '═══════════════════════════════════════════════',
        '',
        `주문 ID : ${orderId}`,
        `상품 ID : ${product.id}`,
        '',
        '— 데모 콘텐츠 —',
        product.description || '실무에서 검증된 AI 노하우 자료.',
        '',
        '※ 데모 시드 상품의 placeholder입니다.',
        '※ 실제 등록 상품은 S3 원본 파일이 다운로드됩니다.',
        '',
        meta,
      ].join('\n');
      return { buf: Buffer.from(body, 'utf-8'), contentType: 'text/plain; charset=utf-8', ext: 'txt' };
    }
  }
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private filesService: FilesService,
    private tokenService: TokenService,
    private fabric: FabricService,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.status !== 'ON_SALE') throw new BadRequestException('구매 불가 상태의 상품입니다');
    if (product.sellerId === buyerId) throw new BadRequestException('본인 상품은 구매할 수 없습니다');

    const usedPoint = dto.usedPoint || 0;
    if (usedPoint > 0) {
      // ACTIVITY 잔액만으로 결제 가능 (PAID는 네이버 전환 전용).
      // 전체 잔액으로 체크하면 PAID까지 깎이는 셈이 돼서 ACTIVITY가 음수로 떨어짐.
      const activityAgg = await this.prisma.pointLog.aggregate({
        where: { userId: buyerId, category: 'ACTIVITY' },
        _sum: { amount: true },
      });
      const activityBalance = activityAgg._sum.amount ?? 0;
      if (activityBalance < usedPoint) {
        throw new BadRequestException(`ACTIVITY 포인트 잔액 부족: 보유 ${activityBalance}P / 사용 ${usedPoint}P`);
      }
      if (usedPoint > product.price) throw new BadRequestException('포인트는 상품 가격을 초과할 수 없습니다');
    }

    // 결제액 계산:
    //   - SQUARE: 가격 × 1.05 (수수료 5%)
    //   - TOSS  : 가격 × 1.05 × 1.10 (수수료 5% + 현금→Square 환산 10%)
    const baseSurcharged = Math.floor(product.price * 1.05);
    const paymentAmount =
      (dto.paymentMethod === 'TOSS' ? Math.floor(baseSurcharged * 1.10) : baseSurcharged) - usedPoint;
    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      if (usedPoint > 0) {
        const latest = await tx.pointLog.findFirst({
          where: { userId: buyerId },
          orderBy: { createdAt: 'desc' },
        });
        await tx.pointLog.create({
          data: {
            userId: buyerId,
            type: 'USE_PURCHASE',
            category: 'ACTIVITY',
            amount: -usedPoint,
            balance: (latest?.balance || 0) - usedPoint,
            memo: `포인트 사용 (${product.title})`,
          },
        });
      }

      const newOrder = await tx.order.create({
        data: {
          buyerId,
          productId: dto.productId,
          paymentMethod: dto.paymentMethod,
          paymentAmount,
          usedPoint: usedPoint || null,
          autoConfirmAt,
          status: 'PAYMENT_PENDING',
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { status: 'SOLD' },
      });

      return newOrder;
    });

    return order;
  }

  async confirmTossPayment(orderId: string, buyerId: string, dto: ConfirmTossPaymentDto) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PAYMENT_PENDING') {
      throw new BadRequestException('결제 대기 상태가 아닙니다');
    }
    if (order.paymentAmount !== dto.amount) {
      throw new BadRequestException(`결제 금액 불일치: 주문금액 ${order.paymentAmount}원`);
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('결제 서비스 설정이 필요합니다');

    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    try {
      await axios.post(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey: dto.paymentKey, orderId, amount: dto.amount },
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      const msg = err?.response?.data?.message || 'Toss 결제 승인 실패';
      throw new BadRequestException(msg);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PENDING_CONFIRMATION', txHash: dto.paymentKey },
      include: { product: { select: { sellerId: true, title: true } } },
    });

    await this.productsService.checkMilestoneBonuses(updated.product.sellerId);

    return updated;
  }

  async confirmSquarePayment(orderId: string, buyerId: string, dto: ConfirmSquarePaymentDto) {
    this.logger.log(`[SQ-PAY] enter orderId=${orderId} buyerId=${buyerId}`);
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PAYMENT_PENDING') {
      throw new BadRequestException('결제 대기 상태가 아닙니다 (현재: ' + order.status + ')');
    }
    if (order.paymentMethod !== 'SQUARE') {
      throw new BadRequestException('Square 결제 주문이 아닙니다');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: order.productId },
      select: { sellerId: true, title: true, price: true },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');

    // 잔액 사전 확인 (체인코드도 검증하지만 메시지를 친절하게)
    const requiredSquare = Math.floor(product.price * 1.05) - (order.usedPoint || 0);
    let balance = 0;
    try {
      balance = await this.fabric.getSquareBalance(buyerId);
    } catch (e: any) {
      this.logger.error(`[SQ-PAY] getSquareBalance 실패: ${e?.message}`);
    }
    this.logger.log(`[SQ-PAY] balance=${balance} required=${requiredSquare} (price=${product.price} usedPoint=${order.usedPoint || 0})`);
    if (balance < requiredSquare) {
      throw new BadRequestException(`Square 잔액 부족: 보유 ${balance} / 필요 ${requiredSquare}`);
    }

    // 에스크로 락업 — 체인코드가 buyer Square 차감 + 거래내역 기록 + 에스크로 상태 생성
    let txHash: string;
    try {
      this.logger.log(`[SQ-PAY] lockEscrow start price=${product.price} usedPoint=${order.usedPoint || 0} sellerId=${product.sellerId}`);
      txHash = await this.fabric.lockEscrow(
        orderId,
        buyerId,
        product.sellerId,
        product.price,
        'SQUARE',
        order.usedPoint || 0,
        order.autoConfirmAt,
      );
      this.logger.log(`[SQ-PAY] lockEscrow ok txHash=${txHash}`);
    } catch (err: any) {
      this.logger.error(`[SQ-PAY] lockEscrow 실패 stack=${err?.stack || err}`);
      throw new BadRequestException('Square 결제 처리 실패: ' + (err?.message || JSON.stringify(err)));
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PENDING_CONFIRMATION', txHash },
      include: { product: { select: { sellerId: true, title: true } } },
    });

    await this.productsService.checkMilestoneBonuses(updated.product.sellerId);

    return updated;
  }

  async confirm(orderId: string, buyerId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('확정할 수 없는 상태입니다');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
      include: { product: { select: { sellerId: true, title: true, price: true } } },
    });

    await this.tokenService.grant(
      updated.product.sellerId, 1, 'EARN_CONFIRM', `구매 확정: ${updated.product.title}`,
    );
    await this.grantConfirmCashback(updated.buyerId, updated.product.sellerId, updated.product.price, updated.product.title);
    await this.releaseEscrow(orderId, updated.product.sellerId, updated.product.price);

    return updated;
  }

  async autoConfirm(orderId: string) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
      include: { product: { select: { sellerId: true, title: true, price: true } } },
    });

    await this.tokenService.grant(
      updated.product.sellerId, 1, 'EARN_CONFIRM', `자동 구매 확정: ${updated.product.title}`,
    );
    await this.grantConfirmCashback(updated.buyerId, updated.product.sellerId, updated.product.price, updated.product.title);
    await this.releaseEscrow(orderId, updated.product.sellerId, updated.product.price);

    return updated;
  }

  async getDownloadUrl(orderId: string, buyerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException();
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (!['PENDING_CONFIRMATION', 'CONFIRMED', 'SETTLEMENT_HOLD'].includes(order.status)) {
      throw new BadRequestException('다운로드 불가 상태입니다');
    }

    const fileKey = order.product.fileKey || '';
    const safeTitle = (order.product.title || 'aisquare').replace(/[^\w가-힣\s.-]+/g, '').trim() || 'aisquare';

    // 시드/데모 상품(fileKey가 mock/*)은 S3에 실파일이 없으므로 BE가 fileType에 맞는 더미 콘텐츠를 inline 반환.
    if (!fileKey || fileKey.startsWith('mock/')) {
      const ft = order.product.fileType as string;
      const dummy = buildDummyFile(ft, order.product, order.id);
      return {
        inlineBase64: dummy.buf.toString('base64'),
        contentType: dummy.contentType,
        filename: `${safeTitle}.${dummy.ext}`,
        url: null,
        expiresIn: 0,
      };
    }

    const url = await this.filesService.getPresignedDownloadUrl(fileKey);
    return { url, expiresIn: 300, filename: `${safeTitle}.${fileKey.split('.').pop() || 'bin'}` };
  }

  // BE가 파일을 직접 가져와서 바이너리로 응답 — CloudFront cross-origin download attribute 무시 우회.
  // 모든 확장자(PDF/PNG/JPG/MP4/ZIP/TXT 등)에 대해 강제 다운로드 동작 보장.
  async streamDownload(orderId: string, buyerId: string): Promise<{ buf: Buffer; contentType: string; filename: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException();
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (!['PENDING_CONFIRMATION', 'CONFIRMED', 'SETTLEMENT_HOLD'].includes(order.status)) {
      throw new BadRequestException('다운로드 불가 상태입니다');
    }

    const fileKey = order.product.fileKey || '';
    const safeTitle = (order.product.title || 'aisquare').replace(/[^\w가-힣\s.-]+/g, '').trim() || 'aisquare';

    // 시드 상품 — 더미 inline 콘텐츠
    if (!fileKey || fileKey.startsWith('mock/')) {
      const ft = order.product.fileType as string;
      const dummy = buildDummyFile(ft, order.product, order.id);
      return { buf: dummy.buf, contentType: dummy.contentType, filename: `${safeTitle}.${dummy.ext}` };
    }

    // 실제 업로드 상품 — S3/CloudFront에서 BE가 fetch
    const url = await this.filesService.getPresignedDownloadUrl(fileKey);
    const resp = await fetch(url);
    if (!resp.ok) {
      this.logger.error(`[stream] fetch 실패 status=${resp.status} url=${url.slice(0, 80)}…`);
      throw new BadRequestException('파일을 가져오지 못했습니다');
    }
    const ab = await resp.arrayBuffer();
    const buf = Buffer.from(ab);
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    const ext = fileKey.split('.').pop() || 'bin';
    return { buf, contentType, filename: `${safeTitle}.${ext}` };
  }

  async getBuyHistory(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        product: { select: { title: true, fileType: true, imageKey: true, price: true } },
        review: { select: { id: true } },
        reports: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSellHistory(sellerId: string) {
    return this.prisma.order.findMany({
      where: { product: { sellerId } },
      include: {
        product: { select: { title: true, price: true } },
        buyer: { select: { username: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingAutoConfirm() {
    return this.prisma.order.findMany({
      where: {
        status: 'PENDING_CONFIRMATION',
        autoConfirmAt: { lte: new Date() },
      },
      include: {
        product: {
          select: {
            title: true,
            seller: { select: { name: true, username: true } },
          },
        },
      },
    });
  }

  private async getOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다');
    return order;
  }

  private async getPointBalance(userId: string): Promise<number> {
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balance || 0;
  }

  // 새 정책 (체인코드 wallet v1.2 sequence 3):
  //   - 구매자·판매자 각 2% Square 캐시백은 체인코드 SettleEscrow 안에서 Square Wallet에 직접 적립
  //   - BE는 회계 감사용 adminLog만 남김 (PointLog 이중 적립 방지)
  private async grantConfirmCashback(buyerId: string, sellerId: string, price: number, productTitle: string) {
    const cashback = Math.floor(price * 0.02);
    const platformRev = Math.floor(price * 0.06);

    await this.prisma.adminLog.create({
      data: {
        adminId: 'system',
        action: 'PLATFORM_REVENUE',
        targetId: productTitle,
        meta: {
          sellerId, buyerId, price,
          payAmount: Math.floor(price * 1.05),
          sellerNet: Math.floor(price * 0.95),
          sellerCashback: cashback,
          buyerCashback: cashback,
          platformRevenue: platformRev,
          rate: 0.06,
          cashbackCurrency: 'SQUARE',
        },
      },
    });
  }

  // Fabric internal-channel wallet chaincode로 에스크로 settle (90% 판매자 정산)
  private async releaseEscrow(orderId: string, sellerId: string, price: number) {
    const settlement = Math.floor(price * 0.9);
    try {
      await this.fabric.settleEscrow(orderId);
      this.logger.log(`Fabric settleEscrow 완료: order=${orderId} seller=${sellerId} 90%=${settlement}`);
    } catch (e: any) {
      this.logger.warn(`Fabric settleEscrow 실패 (DB는 정산 완료): ${e?.message}`);
    }
    // (선택) 외부 BE2 API 호환 — 기존 stub은 유지
    const be2Url = process.env.BE2_API_URL;
    if (!be2Url) {
      this.logger.log(`BE2 에스크로 해제 외부 호출 스킵 (Fabric 내부 처리만)`);
      return;
    }
    try {
      await axios.post(`${be2Url}/escrow/release`, {
        orderId,
        sellerId,
        settlementAmount: Math.floor(price * 0.9),
      });
      this.logger.log(`BE2 에스크로 해제 완료: ${orderId}`);
    } catch (err) {
      this.logger.error(`BE2 에스크로 해제 실패: ${err?.message}`);
    }
  }
}

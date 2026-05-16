import {
  Injectable, UnauthorizedException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import * as bcrypt from 'bcrypt';
import axios from 'axios';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { UpdateBioDto } from './dto/update-bio.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }, { phone: dto.phone }, { nickname: dto.nickname }],
      },
    });
    if (existing?.username === dto.username) throw new ConflictException('이미 사용 중인 아이디입니다');
    if (existing?.email === dto.email) throw new ConflictException('이미 사용 중인 이메일입니다');
    if (existing?.phone === dto.phone) throw new ConflictException('이미 사용 중인 핸드폰 번호입니다');
    if (existing?.nickname === dto.nickname) throw new ConflictException('이미 사용 중인 닉네임입니다');

    const adminUsernames = (process.env.ADMIN_USERNAMES || '')
      .split(',').map((u) => u.trim()).filter(Boolean);
    const isAdmin = adminUsernames.includes(dto.username);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
        nickname: dto.nickname,
        email: dto.email,
        phone: dto.phone,
        isAdmin,
      },
    });

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { accessToken: token, user: this.sanitize(user) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('아이디 또는 비밀번호가 올바르지 않습니다');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('정지 또는 탈퇴된 계정입니다');
    }

    const token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { accessToken: token, user: this.sanitize(user) };
  }

  async verifyPhone(userId: string, dto: VerifyPhoneDto) {
    const impKey = process.env.IMP_KEY;
    const impSecret = process.env.IMP_SECRET;
    if (!impKey || !impSecret) throw new BadRequestException('본인인증 서비스 설정이 필요합니다');

    // 포트원 액세스 토큰 발급
    let accessToken: string;
    try {
      const tokenRes = await axios.post('https://api.iamport.kr/users/getToken', {
        imp_key: impKey,
        imp_secret: impSecret,
      });
      accessToken = tokenRes.data.response.access_token;
    } catch {
      throw new BadRequestException('포트원 인증 토큰 발급 실패');
    }

    // 인증 결과 조회
    let cert: { certified: boolean; phone: string; name: string; unique_key: string };
    try {
      const certRes = await axios.get(
        `https://api.iamport.kr/certifications/${dto.impUid}`,
        { headers: { Authorization: accessToken } },
      );
      cert = certRes.data.response;
    } catch {
      throw new BadRequestException('인증 정보를 조회할 수 없습니다');
    }

    if (!cert.certified) throw new BadRequestException('본인인증에 실패했습니다');

    // 가입 전화번호와 비교 (하이픈 제거 후)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const certPhone = cert.phone.replace(/-/g, '');
    const userPhone = user.phone.replace(/-/g, '');
    if (certPhone !== userPhone) {
      await this.prisma.verificationLog.create({
        data: { userId, type: 'PHONE', status: 'FAILED', meta: { impUid: dto.impUid, certPhone } },
      });
      throw new BadRequestException('가입한 전화번호와 인증 번호가 일치하지 않습니다');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true, passId: cert.unique_key ?? null },
    });

    await this.prisma.verificationLog.create({
      data: { userId, type: 'PHONE', status: 'SUCCESS', meta: { impUid: dto.impUid } },
    });

    return this.sanitize(updated);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  async updateBio(userId: string, dto: UpdateBioDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { bio: dto.bio ?? null },
    });
    return this.sanitize(updated);
  }

  async getTokenHistory(userId: string) {
    return this.tokenService.getHistory(userId);
  }

  async getPointHistory(userId: string) {
    return this.prisma.pointLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

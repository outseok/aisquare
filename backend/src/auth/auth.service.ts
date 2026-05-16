import {
  Injectable, UnauthorizedException, ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }, { phone: dto.phone }],
      },
    });
    if (existing?.username === dto.username) throw new ConflictException('이미 사용 중인 아이디입니다');
    if (existing?.email === dto.email) throw new ConflictException('이미 사용 중인 이메일입니다');
    if (existing?.phone === dto.phone) throw new ConflictException('이미 사용 중인 핸드폰 번호입니다');

    const adminUsernames = (process.env.ADMIN_USERNAMES || '')
      .split(',').map((u) => u.trim()).filter(Boolean);
    const isAdmin = adminUsernames.includes(dto.username);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        name: dto.name,
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

  async verifyPhone(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });

    await this.prisma.verificationLog.create({
      data: { userId, type: 'PHONE', status: 'SUCCESS' },
    });

    return this.sanitize(user);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitize(user);
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}

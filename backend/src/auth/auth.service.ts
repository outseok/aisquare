import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async loginOrRegister(walletAddress: string) {
    const normalizedAddress = walletAddress.toLowerCase();

    let user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    const isNewUser = !user;

    if (!user) {
      const adminWallets = (process.env.ADMIN_WALLET_ADDRESSES || '')
        .split(',')
        .map((a) => a.trim().toLowerCase());

      user = await this.prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
          isAdmin: adminWallets.includes(normalizedAddress),
        },
      });
    }

    if (isNewUser) {
      await this.prisma.verificationLog.create({
        data: {
          userId: user.id,
          walletAddress: normalizedAddress,
          type: 'WALLET_REGISTER',
          status: 'SUCCESS',
        },
      });
    }

    const token = this.jwtService.sign({
      sub: user.id,
      walletAddress: user.walletAddress,
    });

    return { accessToken: token, user };
  }

  async completePassVerification(userId: string, phoneNumber: string) {
    const phoneHash = crypto.createHash('sha256').update(phoneNumber).digest('hex');

    const existing = await this.prisma.user.findUnique({ where: { phoneHash } });
    if (existing && existing.id !== userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      await this.prisma.verificationLog.create({
        data: {
          userId,
          walletAddress: user!.walletAddress,
          type: 'PASS',
          status: 'FAILED',
          phoneHash,
          meta: { reason: '이미 다른 계정에 등록된 번호' },
        },
      });
      throw new UnauthorizedException('이미 다른 계정에 등록된 번호입니다');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { passVerified: true, phoneHash },
    });

    await this.prisma.verificationLog.create({
      data: {
        userId,
        walletAddress: user.walletAddress,
        type: 'PASS',
        status: 'SUCCESS',
        phoneHash,
      },
    });

    return user;
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        walletAddress: true,
        passVerified: true,
        isAdmin: true,
        createdAt: true,
      },
    });
  }
}

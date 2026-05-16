import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenLogType } from '@prisma/client';

const MAX_TOKEN = 200;
const MIN_TOKEN = 0;

@Injectable()
export class TokenService {
  constructor(private prisma: PrismaService) {}

  async grant(userId: string, amount: number, type: TokenLogType, memo: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustToken: true },
    });
    if (!user) return;

    const newBalance = Math.min(MAX_TOKEN, user.trustToken + amount);
    const actual = newBalance - user.trustToken;
    if (actual === 0) return;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { trustToken: newBalance },
      }),
      this.prisma.tokenLog.create({
        data: { userId, type, amount: actual, balance: newBalance, memo },
      }),
    ]);
  }

  async deduct(userId: string, amount: number, type: TokenLogType, memo: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustToken: true },
    });
    if (!user) return;

    const newBalance = Math.max(MIN_TOKEN, user.trustToken - amount);
    const actual = user.trustToken - newBalance;
    if (actual === 0) return;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { trustToken: newBalance },
      }),
      this.prisma.tokenLog.create({
        data: { userId, type, amount: -actual, balance: newBalance, memo },
      }),
    ]);
  }

  async resetToZero(userId: string, memo: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustToken: true },
    });
    if (!user || user.trustToken === 0) return;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { trustToken: 0 },
      }),
      this.prisma.tokenLog.create({
        data: {
          userId,
          type: 'DEDUCT_REPORT',
          amount: -user.trustToken,
          balance: 0,
          memo,
        },
      }),
    ]);
  }

  async getHistory(userId: string) {
    return this.prisma.tokenLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

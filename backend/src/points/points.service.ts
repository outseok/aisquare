import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WithdrawDto } from './dto/withdraw.dto';

const MIN_WITHDRAW_RP = 5000;
// 1,100원 = 100 RP → 1 RP = 11원
const KRW_PER_RP = 11;

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { balance: latest?.balance ?? 0 };
  }

  async getHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.pointLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pointLog.count({ where: { userId } }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    const { balance } = await this.getBalance(userId);

    if (balance < MIN_WITHDRAW_RP) {
      throw new BadRequestException(
        `출금은 ${MIN_WITHDRAW_RP.toLocaleString()} RP 이상 보유 시 가능합니다 (현재 ${balance} RP)`,
      );
    }
    if (dto.amount > balance) {
      throw new BadRequestException('보유 RP가 부족합니다');
    }

    const krwToWithdraw = dto.amount * KRW_PER_RP;

    const newBalance = balance - dto.amount;
    await this.prisma.pointLog.create({
      data: {
        userId,
        type: 'WITHDRAW',
        amount: -dto.amount,
        balance: newBalance,
        memo: `출금 ${dto.amount} RP → ${krwToWithdraw.toLocaleString()}원`,
      },
    });

    return {
      success: true,
      withdrawnRp: dto.amount,
      krwEstimate: krwToWithdraw,
      remainingBalance: newBalance,
    };
  }

  async getUserTokenPercentage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tokenPercentage: true },
    });
    return { tokenPercentage: user?.tokenPercentage ?? 10 };
  }
}

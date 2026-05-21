import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FabricService } from '../fabric/fabric.service';
import { WithdrawDto } from './dto/withdraw.dto';
import { v4 as uuidv4 } from 'uuid';

const MIN_WITHDRAW_RP = 5000;
const KRW_PER_RP = 11;

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  async getBalance(userId: string) {
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return { balance: latest?.balance ?? 0 };
  }

  // PAID 잔액만 분리 조회 (네이버 전환 가능 잔액)
  async getPaidBalance(userId: string) {
    const sum = await this.prisma.pointLog.aggregate({
      where: { userId, category: 'PAID' },
      _sum: { amount: true },
    });
    return { balance: sum._sum.amount ?? 0 };
  }

  // ACTIVITY 잔액 (전환 불가)
  async getActivityBalance(userId: string) {
    const sum = await this.prisma.pointLog.aggregate({
      where: { userId, category: 'ACTIVITY' },
      _sum: { amount: true },
    });
    return { balance: sum._sum.amount ?? 0 };
  }

  // 네이버페이 전환 — PAID 포인트만 사용 가능
  async exchangeToNaver(userId: string, amount: number) {
    if (!amount || amount <= 0) throw new BadRequestException('전환 금액이 잘못됐습니다.');

    const paid = await this.getPaidBalance(userId);
    if (paid.balance < amount) {
      throw new BadRequestException(
        `PAID 포인트가 부족합니다. 보유 ${paid.balance.toLocaleString()} · 요청 ${amount.toLocaleString()}`,
      );
    }

    const exchangeId = 'ex-' + uuidv4();

    // 1) DB에 PENDING 기록
    const record = await this.prisma.naverPointExchange.create({
      data: {
        id: exchangeId,
        userId,
        amountPaid: amount,
        direction: 'AISQUARE_TO_NAVER',
        status: 'PENDING',
      },
    });

    // 2) PointLog NAVER_EXCHANGE_OUT (PAID 차감)
    const balanceAll = (await this.getBalance(userId)).balance;
    await this.prisma.pointLog.create({
      data: {
        userId,
        type: 'NAVER_EXCHANGE_OUT',
        category: 'PAID',
        amount: -amount,
        balance: balanceAll - amount,
        memo: `네이버페이 전환 ${amount} RP → ${(amount).toLocaleString()} NaverPoint`,
        exchangeId,
      },
    });

    // 3) Fabric naver-channel exchange chaincode 호출
    try {
      await this.fabric.exchangeToNaver(exchangeId, userId, amount);
      await this.prisma.naverPointExchange.update({
        where: { id: exchangeId },
        data: { fabricTxId: exchangeId },
      });
    } catch (e: any) {
      this.logger.warn(`Fabric exchangeToNaver 실패 (DB만 기록): ${e?.message}`);
    }

    // 4) Slack 알림 (관리자가 즉시 인지하도록)
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true, nickname: true } });
      const url = process.env.SLACK_WEBHOOK_URL;
      if (url) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `:recycle: *NaverPay 포인트 전환 요청*\n` +
                  `사용자: ${user?.nickname || ''} (@${user?.username || userId})\n` +
                  `금액: *${amount.toLocaleString()} PAID* → 네이버페이\n` +
                  `Exchange ID: \`${exchangeId}\`\n` +
                  `<http://localhost:8000/admin.html|관리자에서 확인 →>`,
          }),
        });
      }
    } catch (e: any) { this.logger.debug(`Slack notify skipped: ${e?.message}`); }

    return { exchangeId, amount, status: 'PENDING', message: 'NaverPay 측에서 적립 확정 시 CONFIRMED로 변경됩니다.' };
  }

  // NaverPay가 확정 호출 (보통 webhook). dev에서는 admin이 수동.
  async confirmNaverExchange(exchangeId: string, naverTxId: string) {
    const rec = await this.prisma.naverPointExchange.findUnique({ where: { id: exchangeId } });
    if (!rec) throw new NotFoundException('전환 내역 없음');
    if (rec.status !== 'PENDING') throw new BadRequestException(`이미 처리됨 (${rec.status})`);
    const updated = await this.prisma.naverPointExchange.update({
      where: { id: exchangeId },
      data: { status: 'CONFIRMED', naverTxId },
    });
    try { await this.fabric.confirmNaverExchange(exchangeId, naverTxId); } catch (e: any) {
      this.logger.warn(`Fabric confirm 실패 (DB만 기록): ${e?.message}`);
    }
    return updated;
  }

  async getMyExchanges(userId: string) {
    return this.prisma.naverPointExchange.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
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
        type: 'CONVERT',
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

  async getUserTrustToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { trustToken: true },
    });
    return { trustToken: user?.trustToken ?? 15 };
  }
}

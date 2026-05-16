import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { PrepareChargeDto } from './dto/prepare-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';

// 충전 시: 1,100원 = 1,000 Square (10% 수수료 포함)
const CHARGE_UNIT_KRW = 1100;
const CHARGE_UNIT_SQ = 1000;
const MIN_CHARGE_SQ = 5000;   // 최소 5,000 Square
const MIN_CHARGE_KRW = 5500;  // 최소 5,500원

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  async prepareCharge(userId: string, dto: PrepareChargeDto) {
    const units = Math.floor(dto.amountKrw / CHARGE_UNIT_KRW);
    const squareAmount = units * CHARGE_UNIT_SQ;
    if (squareAmount < MIN_CHARGE_SQ) {
      throw new BadRequestException(
        `최소 ${MIN_CHARGE_KRW.toLocaleString()}원(${MIN_CHARGE_SQ.toLocaleString()} Square)부터 충전 가능합니다`,
      );
    }

    // 실제 청구 금액: 1,100원 단위로 절사
    const chargeKrw = units * CHARGE_UNIT_KRW;

    const charge = await this.prisma.walletCharge.create({
      data: { userId, amountKrw: chargeKrw, squareAmount, status: 'PENDING' },
    });

    return {
      chargeId: charge.id,
      tossOrderId: charge.id,
      amountKrw: charge.amountKrw,
      squareAmount: charge.squareAmount,
      exchangeInfo: `${CHARGE_UNIT_KRW}원 = ${CHARGE_UNIT_SQ} Square`,
    };
  }

  async confirmCharge(chargeId: string, userId: string, dto: ConfirmChargeDto) {
    const charge = await this.prisma.walletCharge.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('충전 요청을 찾을 수 없습니다');
    if (charge.userId !== userId) throw new ForbiddenException();
    if (charge.status !== 'PENDING') throw new BadRequestException('이미 처리된 충전 요청입니다');
    if (charge.amountKrw !== dto.amount) {
      throw new BadRequestException(`충전 금액 불일치: 요청금액 ${charge.amountKrw}원`);
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('결제 서비스 설정이 필요합니다');

    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    try {
      await axios.post(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey: dto.paymentKey, orderId: chargeId, amount: dto.amount },
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      await this.prisma.walletCharge.update({
        where: { id: chargeId },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(err?.response?.data?.message || 'Toss 결제 승인 실패');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.giveSquareTokens(user?.squareWalletAddr, charge.squareAmount, chargeId);

    // 충전 적립금: 충전 금액의 0.1% Point 지급 (기획서 5절)
    await this.grantChargeBonus(userId, charge.amountKrw);

    const updated = await this.prisma.walletCharge.update({
      where: { id: chargeId },
      data: { status: 'COMPLETED', txHash: dto.paymentKey },
    });

    return updated;
  }

  async getChargeHistory(userId: string) {
    return this.prisma.walletCharge.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // BE2 Hyperledger Fabric 연동 stub — BE2 API 완성 시 실구현으로 교체
  private async giveSquareTokens(walletAddr: string | null | undefined, amount: number, ref: string) {
    const be2Url = process.env.BE2_API_URL;
    if (!be2Url || !walletAddr) {
      this.logger.warn(`BE2 Square 지급 스킵 (walletAddr=${walletAddr}, amount=${amount}, ref=${ref})`);
      return;
    }
    try {
      await axios.post(`${be2Url}/wallet/credit`, { walletAddr, amount, ref });
      this.logger.log(`BE2 Square 지급 완료: ${walletAddr} +${amount} SQ`);
    } catch (err) {
      this.logger.error(`BE2 Square 지급 실패: ${err?.message}`);
    }
  }

  private async grantChargeBonus(userId: string, amountKrw: number) {
    const bonus = Math.floor(amountKrw * 0.001);
    if (bonus <= 0) return;

    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    await this.prisma.pointLog.create({
      data: {
        userId,
        type: 'EARN_BONUS',
        amount: bonus,
        balance: (latest?.balance || 0) + bonus,
        memo: `충전 적립금: ${amountKrw.toLocaleString()}원 충전`,
      },
    });
  }
}

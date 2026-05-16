import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { PrepareChargeDto } from './dto/prepare-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';

const SQUARE_RATE = parseInt(process.env.SQUARE_RATE || '1000', 10); // 1,000원 = 1 Square

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  async prepareCharge(userId: string, dto: PrepareChargeDto) {
    const squareAmount = Math.floor(dto.amountKrw / SQUARE_RATE);
    if (squareAmount < 1) {
      throw new BadRequestException(`최소 1원부터 충전 가능합니다`);
    }

    const charge = await this.prisma.walletCharge.create({
      data: { userId, amountKrw: dto.amountKrw, squareAmount, status: 'PENDING' },
    });

    return {
      chargeId: charge.id,
      tossOrderId: charge.id,
      amountKrw: charge.amountKrw,
      squareAmount: charge.squareAmount,
      exchangeRate: SQUARE_RATE,
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

    // Toss 결제 승인
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

    // Square 지급 (BE2 연동)
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    await this.giveSquareTokens(user?.squareWalletAddr, charge.squareAmount, chargeId);

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
}

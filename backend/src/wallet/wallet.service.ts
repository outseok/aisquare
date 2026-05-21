import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { FabricService } from '../fabric/fabric.service';
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

  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  async getSquareBalance(userId: string) {
    const balance = await this.fabric.getSquareBalance(userId).catch((e) => {
      this.logger.warn(`Fabric getSquareBalance 실패: ${e?.message}`);
      return 0;
    });
    return { balance };
  }

  async getSquareHistory(userId: string) {
    const history = await this.fabric.getSquareHistory(userId).catch((e) => {
      this.logger.warn(`Fabric getSquareHistory 실패: ${e?.message}`);
      return [] as unknown[];
    });
    return { items: history };
  }

  /**
   * YR 브랜치 호환 — Toss 검증 없는 즉시 충전.
   * 사용처: 데모/개발 환경에서 결제 게이트웨이 우회로 잔액 적립.
   * 검증 PASS, 단위(최소 5,000 · 1,000 단위)는 여기서 함.
   */
  async instantCharge(userId: string, dto: { squareAmount: number }) {
    const squareAmount = Math.floor(Number(dto.squareAmount));
    if (!Number.isFinite(squareAmount) || squareAmount < MIN_CHARGE_SQ) {
      throw new BadRequestException(`최소 ${MIN_CHARGE_SQ.toLocaleString()} Square부터 충전 가능합니다`);
    }
    if (squareAmount % CHARGE_UNIT_SQ !== 0) {
      throw new BadRequestException(`${CHARGE_UNIT_SQ.toLocaleString()} Square 단위로 입력해주세요`);
    }
    const units = squareAmount / CHARGE_UNIT_SQ;
    const amountKrw = units * CHARGE_UNIT_KRW;

    const charge = await this.prisma.walletCharge.create({
      data: { userId, amountKrw, squareAmount, status: 'COMPLETED', txHash: 'instant' },
    });

    // 실제 Square 적립
    try {
      await this.fabric.depositSquare(
        userId,
        squareAmount,
        `즉시 충전 ${amountKrw.toLocaleString()}원 → ${squareAmount.toLocaleString()} SQ (charge=${charge.id})`,
      );
    } catch (err: any) {
      this.logger.error(`Fabric depositSquare 실패: ${err?.message}`);
      await this.prisma.walletCharge.update({ where: { id: charge.id }, data: { status: 'FAILED' } });
      throw new BadRequestException('Square 적립 중 오류가 발생했습니다');
    }

    // Point 보너스 (충전 KRW의 0.1%)
    await this.grantChargeBonus(userId, amountKrw);

    const balance = await this.fabric.getSquareBalance(userId).catch(() => 0);
    const pointBonus = Math.floor(amountKrw * 0.001);

    return {
      success: true,
      chargeId: charge.id,
      squareAmount,
      amountKrw,
      pointBonus,
      balance,
    };
  }

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

    // Fabric에 실제 Square 적립 (체인코드 wallet.DepositSquare)
    try {
      await this.fabric.depositSquare(
        userId,
        charge.squareAmount,
        `Toss 충전 ${charge.amountKrw.toLocaleString()}원 → ${charge.squareAmount.toLocaleString()} SQ (charge=${chargeId})`,
      );
    } catch (err: any) {
      this.logger.error(`Fabric depositSquare 실패: ${err?.message}`);
      throw new BadRequestException(
        '결제는 승인됐으나 Square 적립 중 오류가 발생했습니다. 관리자에게 문의해주세요.',
      );
    }

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

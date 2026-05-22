import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { ChargeRpDto } from './dto/charge-rp.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
import { RequestProductPayDto } from './dto/request-product-pay.dto';
import { ConfirmProductPayDto } from './dto/confirm-product-pay.dto';
import { FabricService } from '../fabric/fabric.service';

// 환율: 100 RP = 1,100원 → 1 RP = 11원
const KRW_PER_100RP = 1100;
const CHARGE_BONUS_RATE = 0.0001; // 충전 금액의 0.01% 추가 적립

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly tossBaseUrl = 'https://api.tosspayments.com/v1';

  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  getTossClientKey() {
    return {
      clientKey: process.env.TOSS_CLIENT_KEY,
      devBypass: process.env.TOSS_DEV_BYPASS === '1',
    };
  }

  // ── RP 충전 ────────────────────────────────────────────────────────────────

  async requestRpCharge(userId: string, dto: ChargeRpDto) {
    const amountKrw = Math.floor((dto.amount / 100) * KRW_PER_100RP);
    const tossOrderId = `rp-${uuidv4()}`;

    await this.prisma.tossPayment.create({
      data: {
        userId,
        tossOrderId,
        amount: amountKrw,
        purpose: 'RP_CHARGE',
        status: 'PENDING',
        rpGranted: dto.amount,
      },
    });

    return {
      tossOrderId,
      amountKrw,
      rpAmount: dto.amount,
      orderName: `Recode AI 포인트 충전 ${dto.amount} RP`,
    };
  }

  async confirmRpCharge(userId: string, dto: ConfirmChargeDto) {
    const record = await this.prisma.tossPayment.findUnique({
      where: { tossOrderId: dto.orderId },
    });
    if (!record) throw new NotFoundException('결제 정보를 찾을 수 없습니다');
    if (record.userId !== userId) throw new BadRequestException('본인 결제만 처리 가능합니다');
    if (record.status !== 'PENDING') throw new BadRequestException('이미 처리된 결제입니다');
    if (record.amount !== dto.amount) throw new BadRequestException('결제 금액이 일치하지 않습니다');

    await this.confirmWithToss(dto.paymentKey, dto.orderId, dto.amount);

    const rpAmount = record.rpGranted!;
    const bonusRp = Math.floor(dto.amount * CHARGE_BONUS_RATE);

    await this.prisma.$transaction(async (tx) => {
      await tx.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { paymentKey: dto.paymentKey, status: 'CONFIRMED' },
      });

      const balance = await this.getPointBalance(userId, tx);
      await tx.pointLog.create({
        data: {
          userId,
          type: 'CHARGE',
          category: 'PAID',   // 결제 포인트 — 네이버 전환 가능
          amount: rpAmount,
          balance: balance + rpAmount,
          memo: `토스 충전 ${dto.amount.toLocaleString()}원 → ${rpAmount} RP (PAID)`,
        },
      });

      if (bonusRp > 0) {
        const afterCharge = balance + rpAmount;
        await tx.pointLog.create({
          data: {
            userId,
            type: 'EARN_BONUS',  // 충전 보너스도 결제 포인트 (외부 전환 가능)
            category: 'PAID',
            amount: bonusRp,
            balance: afterCharge + bonusRp,
            memo: `충전 적립 보너스 ${bonusRp} RP (PAID)`,
          },
        });
      }
    });

    await this.fabric.issuePoints(userId, rpAmount + bonusRp, `충전 ${dto.orderId}`).catch(
      (e) => this.logger.warn('Fabric issuePoints 실패 (무시)', e?.message),
    );
    // naver-channel PAID 잔액에도 동기화 (외부 전환 가능하게 만들기 위함)
    await this.fabric.issuePaid(userId, rpAmount + bonusRp, `토스 충전 ${dto.orderId}`).catch(
      (e) => this.logger.warn('Fabric IssuePaid 실패 (체인-DB 불일치)', e?.message),
    );

    return { success: true, rpCharged: rpAmount, bonusRp };
  }

  // ── 상품 구매 (원화 결제) ──────────────────────────────────────────────────

  async requestProductPay(buyerId: string, dto: RequestProductPayDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.status !== 'ON_SALE') throw new BadRequestException('구매 불가 상태의 상품입니다');
    if (product.sellerId === buyerId) throw new BadRequestException('본인 상품은 구매할 수 없습니다');

    // Toss(현금) 결제는 5% 거래 수수료 + 10% 현금↔Square 환산 수수료 둘 다 부과 = price × 1.05 × 1.10
    const amountKrw = Math.floor(Math.floor(product.price * 1.05) * 1.10);
    const priceRp = Math.floor((amountKrw * 100) / KRW_PER_100RP);
    const tossOrderId = `prod-${uuidv4()}`;

    await this.prisma.tossPayment.create({
      data: {
        userId: buyerId,
        tossOrderId,
        amount: amountKrw,
        purpose: 'PRODUCT_PURCHASE',
        status: 'PENDING',
        relatedId: dto.productId,
        rpGranted: priceRp,
      },
    });

    return { tossOrderId, amountKrw, orderName: product.title };
  }

  async confirmProductPay(buyerId: string, dto: ConfirmProductPayDto) {
    const record = await this.prisma.tossPayment.findUnique({
      where: { tossOrderId: dto.orderId },
    });
    if (!record) throw new NotFoundException('결제 정보를 찾을 수 없습니다');
    if (record.userId !== buyerId) throw new BadRequestException('본인 결제만 처리 가능합니다');
    if (record.status !== 'PENDING') throw new BadRequestException('이미 처리된 결제입니다');
    if (record.amount !== dto.amount) throw new BadRequestException('결제 금액이 일치하지 않습니다');

    await this.confirmWithToss(dto.paymentKey, dto.orderId, dto.amount);

    const productId = record.relatedId!;
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.status !== 'ON_SALE') {
      await this.cancelWithToss(dto.paymentKey, '상품이 이미 판매된 상태입니다');
      await this.prisma.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { status: 'CANCELLED' },
      });
      throw new BadRequestException('상품 상태가 변경되어 결제를 취소했습니다');
    }

    const priceRp = record.rpGranted!;
    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { paymentKey: dto.paymentKey, status: 'CONFIRMED' },
      });

      const newOrder = await tx.order.create({
        data: {
          buyerId,
          productId,
          paymentMethod: 'TOSS',
          paymentAmount: dto.amount,
          autoConfirmAt,
          status: 'PENDING_CONFIRMATION',
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { status: 'SOLD' },
      });

      return newOrder;
    });

    // Fabric 에스크로 락업 (Toss 결제 — 실제 자금은 Toss에서 관리, 온체인 기록만)
    await this.fabric
      .lockEscrow(order.id, buyerId, product.sellerId, priceRp, 'TOSS', 0, autoConfirmAt)
      .catch((e) => this.logger.warn('Fabric lockEscrow 실패 (무시)', e?.message));
    // 불변 거래 원장 기록
    await this.fabric
      .recordTrade(order.id, productId, buyerId, product.sellerId, priceRp, 'TOSS')
      .catch((e) => this.logger.warn('Fabric recordTrade 실패 (무시)', e?.message));

    return { success: true, orderId: order.id };
  }

  // ── Toss API 호출 헬퍼 ─────────────────────────────────────────────────────

  private async confirmWithToss(paymentKey: string, orderId: string, amount: number) {
    // Dev mode — short-circuit so a full purchase flow can be demoed without
    // valid Toss merchant keys (the public docs keys often 401).
    if (process.env.TOSS_DEV_BYPASS === '1') {
      this.logger.warn(`[Toss dev bypass] confirm faked for order=${orderId} amount=${amount}`);
      return { paymentKey, orderId, amount, status: 'DONE' };
    }

    const secretKey = process.env.TOSS_SECRET_KEY!;
    const encoded = Buffer.from(`${secretKey}:`).toString('base64');

    try {
      const { data } = await axios.post(
        `${this.tossBaseUrl}/payments/confirm`,
        { paymentKey, orderId, amount },
        { headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' } },
      );
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.message ?? '토스 결제 승인 실패';
      this.logger.error('Toss confirm error', err.response?.data);
      throw new BadRequestException(msg);
    }
  }

  private async cancelWithToss(paymentKey: string, cancelReason: string) {
    const secretKey = process.env.TOSS_SECRET_KEY!;
    const encoded = Buffer.from(`${secretKey}:`).toString('base64');
    try {
      await axios.post(
        `${this.tossBaseUrl}/payments/${paymentKey}/cancel`,
        { cancelReason },
        { headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' } },
      );
    } catch (err: any) {
      this.logger.error('Toss cancel error', err.response?.data);
    }
  }

  private async getPointBalance(userId: string, tx?: any): Promise<number> {
    const client = tx ?? this.prisma;
    const latest = await client.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balance ?? 0;
  }
}

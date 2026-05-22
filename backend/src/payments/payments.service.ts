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

    // Toss(현금) 결제는 5% 거래 수수료 + 10% 현금↔Square 환산 수수료 = price × 1.05 × 1.10
    const grossKrw = Math.floor(Math.floor(product.price * 1.05) * 1.10);
    // Point 할인 적용 (1 Point = 1원). 보유 Point 한도 내로 강제
    let usedPoint = Math.max(0, Math.floor(dto.usedPoint || 0));
    if (usedPoint > 0) {
      const currentPoints = await this.getActivityPointBalance(buyerId);
      usedPoint = Math.min(usedPoint, currentPoints, product.price);
    }
    const amountKrw = Math.max(0, grossKrw - usedPoint);
    const priceRp = Math.floor((grossKrw * 100) / KRW_PER_100RP);
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
        // usedPoint 정보는 metadata 컬럼이 없으니 별도 record로 추적은 불가
        // confirm 시 다시 한 번 차감되도록 amountKrw에 이미 반영됨
      },
    });

    return { tossOrderId, amountKrw, orderName: product.title, usedPoint, grossKrw };
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

    // Point 할인 사용 추정 — 정가(grossKrw) - 실결제액(amount)
    const grossKrw = Math.floor(Math.floor(product.price * 1.05) * 1.10);
    const usedPoint = Math.max(0, grossKrw - dto.amount);
    if (usedPoint > 0) {
      const activityBalance = await this.getActivityPointBalance(buyerId);
      if (activityBalance < usedPoint) {
        await this.cancelWithToss(dto.paymentKey, 'ACTIVITY 포인트 잔액 부족');
        await this.prisma.tossPayment.update({
          where: { tossOrderId: dto.orderId },
          data: { status: 'CANCELLED' },
        });
        throw new BadRequestException(`ACTIVITY 포인트 잔액 부족: 보유 ${activityBalance}P / 사용 ${usedPoint}P`);
      }
    }

    const priceRp = record.rpGranted!;
    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      await tx.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { paymentKey: dto.paymentKey, status: 'CONFIRMED' },
      });

      if (usedPoint > 0) {
        const balance = await this.getPointBalance(buyerId, tx);
        await tx.pointLog.create({
          data: {
            userId: buyerId,
            type: 'USE_PURCHASE',
            category: 'ACTIVITY' as any,
            amount: -usedPoint,
            balance: balance - usedPoint,
            memo: `Toss 결제 Point 할인: ${product.title}`,
          },
        });
      }

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

  private async getActivityPointBalance(userId: string, tx?: any): Promise<number> {
    const client = tx ?? this.prisma;
    const agg = await client.pointLog.aggregate({
      where: { userId, category: 'ACTIVITY' },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  }

  // ── 장바구니 일괄 Toss 결제 ─────────────────────────────────────────────────
  async requestCartPay(buyerId: string, productIds: string[], usedPointReq: number = 0) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new BadRequestException('결제할 상품이 없습니다');
    }
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('일부 상품을 찾을 수 없습니다');
    }
    for (const p of products) {
      if (p.status !== 'ON_SALE') throw new BadRequestException(`판매중 아님: ${p.title}`);
      if (p.sellerId === buyerId) throw new BadRequestException(`본인 상품 포함: ${p.title}`);
    }
    // 각 항목 price × 1.05 × 1.10 (Toss 5% + 환산 10%) 의 합
    const grossKrw = products.reduce(
      (s, p) => s + Math.floor(Math.floor(p.price * 1.05) * 1.10),
      0,
    );
    const productTotal = products.reduce((s, p) => s + p.price, 0);
    // Point 할인 (1 Point = 1원, ACTIVITY 보유 한도)
    let usedPoint = Math.max(0, Math.floor(usedPointReq || 0));
    if (usedPoint > 0) {
      const bal = await this.getActivityPointBalance(buyerId);
      usedPoint = Math.min(usedPoint, bal, productTotal);
    }
    const amountKrw = Math.max(0, grossKrw - usedPoint);
    const priceRp = Math.floor((grossKrw * 100) / KRW_PER_100RP);
    const tossOrderId = `cart-${uuidv4()}`;
    await this.prisma.tossPayment.create({
      data: {
        userId: buyerId,
        tossOrderId,
        amount: amountKrw,
        purpose: 'PRODUCT_PURCHASE',
        status: 'PENDING',
        relatedId: productIds.join(','),
        rpGranted: priceRp,
      },
    });
    const orderName = products.length === 1
      ? products[0].title
      : `${products[0].title} 외 ${products.length - 1}건`;
    return { tossOrderId, amountKrw, orderName, count: products.length, usedPoint, grossKrw };
  }

  async confirmCartPay(buyerId: string, dto: ConfirmProductPayDto) {
    const record = await this.prisma.tossPayment.findUnique({
      where: { tossOrderId: dto.orderId },
    });
    if (!record) throw new NotFoundException('결제 정보를 찾을 수 없습니다');
    if (record.userId !== buyerId) throw new BadRequestException('본인 결제만 처리 가능합니다');
    if (record.status !== 'PENDING') throw new BadRequestException('이미 처리된 결제입니다');
    if (record.amount !== dto.amount) throw new BadRequestException('결제 금액이 일치하지 않습니다');

    // Toss 한 번만 confirm (전체 금액)
    await this.confirmWithToss(dto.paymentKey, dto.orderId, dto.amount);

    const productIds = (record.relatedId || '').split(',').filter(Boolean);
    const products = await this.prisma.product.findMany({ where: { id: { in: productIds } } });
    const stillOnSale = products.filter((p) => p.status === 'ON_SALE');
    if (stillOnSale.length === 0) {
      await this.cancelWithToss(dto.paymentKey, '모든 상품이 이미 판매됨');
      await this.prisma.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { status: 'CANCELLED' },
      });
      throw new BadRequestException('모든 상품 상태가 변경되어 결제를 취소했습니다');
    }

    // Point 할인 사용 추정 (전체 합산 정가 - 실결제액)
    const grossKrwTotal = stillOnSale.reduce(
      (s, p) => s + Math.floor(Math.floor(p.price * 1.05) * 1.10),
      0,
    );
    const usedPoint = Math.max(0, grossKrwTotal - dto.amount);
    if (usedPoint > 0) {
      const activityBalance = await this.getActivityPointBalance(buyerId);
      if (activityBalance < usedPoint) {
        await this.cancelWithToss(dto.paymentKey, 'ACTIVITY 포인트 잔액 부족');
        await this.prisma.tossPayment.update({
          where: { tossOrderId: dto.orderId },
          data: { status: 'CANCELLED' },
        });
        throw new BadRequestException(`ACTIVITY 포인트 잔액 부족: 보유 ${activityBalance}P / 사용 ${usedPoint}P`);
      }
    }

    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const createdOrders: any[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { paymentKey: dto.paymentKey, status: 'CONFIRMED' },
      });
      // Point 차감 로그 (1건만)
      if (usedPoint > 0) {
        const balance = await this.getPointBalance(buyerId, tx);
        await tx.pointLog.create({
          data: {
            userId: buyerId,
            type: 'USE_PURCHASE',
            category: 'ACTIVITY' as any,
            amount: -usedPoint,
            balance: balance - usedPoint,
            memo: `장바구니 일괄 Toss 결제 Point 할인 (${stillOnSale.length}건)`,
          },
        });
      }
      for (const product of stillOnSale) {
        const perItem = Math.floor(Math.floor(product.price * 1.05) * 1.10);
        const order = await tx.order.create({
          data: {
            buyerId,
            productId: product.id,
            paymentMethod: 'TOSS',
            paymentAmount: perItem,
            autoConfirmAt,
            status: 'PENDING_CONFIRMATION',
          },
        });
        await tx.product.update({
          where: { id: product.id },
          data: { status: 'SOLD' },
        });
        await tx.cartItem.deleteMany({ where: { userId: buyerId, productId: product.id } }).catch(() => null);
        createdOrders.push({ order, product });
      }
    });

    // Fabric 에스크로 락업 + 거래 원장 (각 주문 별로)
    for (const { order, product } of createdOrders) {
      const perItem = order.paymentAmount;
      const priceRp = Math.floor((perItem * 100) / KRW_PER_100RP);
      await this.fabric
        .lockEscrow(order.id, buyerId, product.sellerId, priceRp, 'TOSS', 0, autoConfirmAt)
        .catch((e) => this.logger.warn(`Fabric lockEscrow 실패 (${order.id}): ${e?.message}`));
      await this.fabric
        .recordTrade(order.id, product.id, buyerId, product.sellerId, priceRp, 'TOSS')
        .catch((e) => this.logger.warn(`Fabric recordTrade 실패 (${order.id}): ${e?.message}`));
    }

    return {
      success: true,
      orderIds: createdOrders.map((o) => o.order.id),
      count: createdOrders.length,
      soldOut: products.length - stillOnSale.length,
    };
  }
}

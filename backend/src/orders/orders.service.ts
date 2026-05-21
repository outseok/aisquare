import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmTossPaymentDto } from './dto/confirm-toss-payment.dto';
import { ConfirmSquarePaymentDto } from './dto/confirm-square-payment.dto';
import { ProductsService } from '../products/products.service';
import { FilesService } from '../files/files.service';
import { TokenService } from '../token/token.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private filesService: FilesService,
    private tokenService: TokenService,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.status !== 'ON_SALE') throw new BadRequestException('구매 불가 상태의 상품입니다');
    if (product.sellerId === buyerId) throw new BadRequestException('본인 상품은 구매할 수 없습니다');

    const usedPoint = dto.usedPoint || 0;
    if (usedPoint > 0) {
      const balance = await this.getPointBalance(buyerId);
      if (balance < usedPoint) throw new BadRequestException(`포인트 잔액 부족: 보유 ${balance}P`);
      if (usedPoint > product.price) throw new BadRequestException('포인트는 상품 가격을 초과할 수 없습니다');
    }

    const paymentAmount = product.price - usedPoint;
    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      if (usedPoint > 0) {
        const latest = await tx.pointLog.findFirst({
          where: { userId: buyerId },
          orderBy: { createdAt: 'desc' },
        });
        await tx.pointLog.create({
          data: {
            userId: buyerId,
            type: 'USE_PURCHASE',
            amount: -usedPoint,
            balance: (latest?.balance || 0) - usedPoint,
            memo: `포인트 사용: ${product.title}`,
          },
        });
      }

      const newOrder = await tx.order.create({
        data: {
          buyerId,
          productId: dto.productId,
          paymentMethod: dto.paymentMethod,
          paymentAmount,
          usedPoint: usedPoint || null,
          autoConfirmAt,
          status: 'PAYMENT_PENDING',
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { status: 'SOLD' },
      });

      return newOrder;
    });

    return order;
  }

  async confirmTossPayment(orderId: string, buyerId: string, dto: ConfirmTossPaymentDto) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PAYMENT_PENDING') {
      throw new BadRequestException('결제 대기 상태가 아닙니다');
    }
    if (order.paymentAmount !== dto.amount) {
      throw new BadRequestException(`결제 금액 불일치: 주문금액 ${order.paymentAmount}원`);
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('결제 서비스 설정이 필요합니다');

    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    try {
      await axios.post(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey: dto.paymentKey, orderId, amount: dto.amount },
        { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
      );
    } catch (err) {
      const msg = err?.response?.data?.message || 'Toss 결제 승인 실패';
      throw new BadRequestException(msg);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PENDING_CONFIRMATION', txHash: dto.paymentKey },
      include: { product: { select: { sellerId: true, title: true } } },
    });

    await this.productsService.checkMilestoneBonuses(updated.product.sellerId);

    return updated;
  }

  async confirmSquarePayment(orderId: string, buyerId: string, dto: ConfirmSquarePaymentDto) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PAYMENT_PENDING') {
      throw new BadRequestException('결제 대기 상태가 아닙니다');
    }
    if (order.paymentMethod !== 'SQUARE') {
      throw new BadRequestException('Square 결제 주문이 아닙니다');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'PENDING_CONFIRMATION', txHash: dto.txHash },
      include: { product: { select: { sellerId: true, title: true } } },
    });

    await this.productsService.checkMilestoneBonuses(updated.product.sellerId);

    return updated;
  }

  async confirm(orderId: string, buyerId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('확정할 수 없는 상태입니다');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
      include: { product: { select: { sellerId: true, title: true, price: true } } },
    });

    await this.tokenService.grant(
      updated.product.sellerId, 1, 'EARN_CONFIRM', `구매 확정: ${updated.product.title}`,
    );
    await this.grantConfirmCashback(updated.buyerId, updated.product.sellerId, updated.product.price, updated.product.title);
    await this.releaseEscrow(orderId, updated.product.sellerId, updated.product.price);

    return updated;
  }

  async autoConfirm(orderId: string) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
      include: { product: { select: { sellerId: true, title: true, price: true } } },
    });

    await this.tokenService.grant(
      updated.product.sellerId, 1, 'EARN_CONFIRM', `자동 구매 확정: ${updated.product.title}`,
    );
    await this.grantConfirmCashback(updated.buyerId, updated.product.sellerId, updated.product.price, updated.product.title);
    await this.releaseEscrow(orderId, updated.product.sellerId, updated.product.price);

    return updated;
  }

  async getDownloadUrl(orderId: string, buyerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: true },
    });
    if (!order) throw new NotFoundException();
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (!['PENDING_CONFIRMATION', 'CONFIRMED', 'SETTLEMENT_HOLD'].includes(order.status)) {
      throw new BadRequestException('다운로드 불가 상태입니다');
    }

    const url = await this.filesService.getPresignedDownloadUrl(order.product.fileKey);
    return { url, expiresIn: 300 };
  }

  async getBuyHistory(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        product: { select: { title: true, fileType: true, imageKey: true, price: true } },
        review: { select: { id: true } },
        reports: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSellHistory(sellerId: string) {
    return this.prisma.order.findMany({
      where: { product: { sellerId } },
      include: {
        product: { select: { title: true, price: true } },
        buyer: { select: { username: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingAutoConfirm() {
    return this.prisma.order.findMany({
      where: {
        status: 'PENDING_CONFIRMATION',
        autoConfirmAt: { lte: new Date() },
      },
      include: {
        product: {
          select: {
            title: true,
            seller: { select: { name: true, username: true } },
          },
        },
      },
    });
  }

  private async getOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다');
    return order;
  }

  private async getPointBalance(userId: string): Promise<number> {
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balance || 0;
  }

  // 구매 확정 시 구매자·판매자 각 2% ACTIVITY Point 캐시백 + 플랫폼 6% 기록 (기획서 4.4절)
  private async grantConfirmCashback(buyerId: string, sellerId: string, price: number, productTitle: string) {
    const cashback = Math.floor(price * 0.02);
    const platformRev = Math.floor(price * 0.06);

    const [buyerBalance, sellerBalance] = await Promise.all([
      this.getPointBalance(buyerId),
      this.getPointBalance(sellerId),
    ]);

    if (cashback > 0) {
      await this.prisma.pointLog.create({
        data: {
          userId: buyerId,
          type: 'EARN_ACTIVITY',
          category: 'ACTIVITY',  // 캐시백 = 활동 포인트 (전환 불가)
          amount: cashback,
          balance: buyerBalance + cashback,
          memo: `구매 확정 캐시백 2%: ${productTitle}`,
        },
      });
      await this.prisma.pointLog.create({
        data: {
          userId: sellerId,
          type: 'EARN_ACTIVITY',
          category: 'ACTIVITY',
          amount: cashback,
          balance: sellerBalance + cashback,
          memo: `판매 확정 캐시백 2%: ${productTitle}`,
        },
      });
    }

    // 플랫폼 수익 6% — adminLog로 기록 (회계용)
    if (platformRev > 0) {
      await this.prisma.adminLog.create({
        data: {
          adminId: 'system',
          action: 'PLATFORM_REVENUE',
          targetId: productTitle,
          meta: { sellerId, buyerId, price, platformRevenue: platformRev, rate: 0.06 },
        },
      });
    }
  }

  // Fabric internal-channel wallet chaincode로 에스크로 settle (90% 판매자 정산)
  private async releaseEscrow(orderId: string, sellerId: string, price: number) {
    const settlement = Math.floor(price * 0.9);
    try {
      await this.fabric.settleEscrow(orderId);
      this.logger.log(`Fabric settleEscrow 완료: order=${orderId} seller=${sellerId} 90%=${settlement}`);
    } catch (e: any) {
      this.logger.warn(`Fabric settleEscrow 실패 (DB는 정산 완료): ${e?.message}`);
    }
    // (선택) 외부 BE2 API 호환 — 기존 stub은 유지
    const be2Url = process.env.BE2_API_URL;
    if (!be2Url) {
      this.logger.log(`BE2 에스크로 해제 외부 호출 스킵 (Fabric 내부 처리만)`);
      return;
    }
    try {
      await axios.post(`${be2Url}/escrow/release`, {
        orderId,
        sellerId,
        settlementAmount: Math.floor(price * 0.9),
      });
      this.logger.log(`BE2 에스크로 해제 완료: ${orderId}`);
    } catch (err) {
      this.logger.error(`BE2 에스크로 해제 실패: ${err?.message}`);
    }
  }
}

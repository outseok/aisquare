import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmTossPaymentDto } from './dto/confirm-toss-payment.dto';
import { ProductsService } from '../products/products.service';
import { FilesService } from '../files/files.service';
import { TokenService } from '../token/token.service';

@Injectable()
export class OrdersService {
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

    const paymentAmount = product.price;
    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          buyerId,
          productId: dto.productId,
          paymentMethod: dto.paymentMethod,
          paymentAmount,
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
      include: { product: { select: { sellerId: true, title: true, price: true } } },
    });

    await this.grantSaleBonus(updated.product.sellerId, updated.product.price, updated.product.title);
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
      include: { product: { select: { sellerId: true, title: true } } },
    });

    await this.tokenService.grant(
      updated.product.sellerId, 1, 'EARN_CONFIRM', `구매 확정: ${updated.product.title}`,
    );

    return updated;
  }

  async autoConfirm(orderId: string) {
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
      include: { product: { select: { sellerId: true, title: true } } },
    });

    await this.tokenService.grant(
      updated.product.sellerId, 1, 'EARN_CONFIRM', `자동 구매 확정: ${updated.product.title}`,
    );

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

  private async grantSaleBonus(sellerId: string, priceKrw: number, productTitle: string) {
    let rate: number;
    if (priceKrw < 5_000) rate = 0.05;
    else if (priceKrw < 20_000) rate = 0.07;
    else if (priceKrw < 50_000) rate = 0.10;
    else rate = 0.12;

    const bonusRp = Math.floor(priceKrw * rate);

    const balance = await this.getPointBalance(sellerId);
    await this.prisma.pointLog.create({
      data: {
        userId: sellerId,
        type: 'EARN_SALE',
        amount: bonusRp,
        balance: balance + bonusRp,
        memo: `판매 보상: ${productTitle}`,
      },
    });
  }
}

import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
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
          status: 'PENDING_CONFIRMATION',
        },
      });

      await tx.product.update({
        where: { id: dto.productId },
        data: { status: 'SOLD' },
      });

      return newOrder;
    });

    await this.grantSaleBonus(product.sellerId, product.price, product.title);
    await this.productsService.checkMilestoneBonuses(product.sellerId);

    return order;
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

  private async deductPoints(userId: string, amount: number, memo: string) {
    const balance = await this.getPointBalance(userId);
    await this.prisma.pointLog.create({
      data: { userId, type: 'USE_PURCHASE', amount: -amount, balance: balance - amount, memo },
    });
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

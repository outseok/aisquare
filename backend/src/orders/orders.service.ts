import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma } from '@prisma/client';
import { ProductsService } from '../products/products.service';
import { FilesService } from '../files/files.service';

const RP_PER_ETH = 10_000_000; // 10,000 RP = 0.001 ETH → 1 ETH = 10,000,000 RP

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
    private filesService: FilesService,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.status !== 'ON_SALE') throw new BadRequestException('구매 불가 상태의 상품입니다');
    if (product.sellerId === buyerId) throw new BadRequestException('본인 상품은 구매할 수 없습니다');

    const amountEth = product.priceEth;
    let amountRp: number | undefined;

    if (dto.paymentMethod === 'RP') {
      const rpNeeded = Math.ceil(Number(amountEth) * RP_PER_ETH);
      const balance = await this.getPointBalance(buyerId);
      if (balance < rpNeeded) throw new BadRequestException('포인트 잔액이 부족합니다');
      amountRp = rpNeeded;
      await this.deductPoints(buyerId, rpNeeded, `상품 구매: ${product.title}`);
    }

    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          buyerId,
          productId: dto.productId,
          paymentMethod: dto.paymentMethod,
          amountEth,
          amountRp,
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

    await this.grantSaleBonus(product.sellerId, Number(amountEth), product.title);
    await this.productsService.checkMilestoneBonuses(product.sellerId);

    return order;
  }

  async confirm(orderId: string, buyerId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('확정할 수 없는 상태입니다');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
    });
  }

  async autoConfirm(orderId: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
    });
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
        product: { select: { title: true, fileType: true, imageKey: true, priceEth: true } },
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
        product: { select: { title: true, priceEth: true } },
        buyer: { select: { walletAddress: true } },
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
        product: { select: { title: true, seller: { select: { walletAddress: true } } } },
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

  private async grantSaleBonus(sellerId: string, priceEth: number, productTitle: string) {
    let rate: number;
    if (priceEth < 0.001) rate = 0.05;
    else if (priceEth < 0.005) rate = 0.07;
    else if (priceEth < 0.01) rate = 0.10;
    else rate = 0.12;

    const bonusEth = priceEth * rate;
    const bonusRp = Math.floor(bonusEth * RP_PER_ETH);

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

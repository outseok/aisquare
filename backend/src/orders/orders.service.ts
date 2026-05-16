import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IpfsService } from '../ipfs/ipfs.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';
import { FilesService } from '../files/files.service';
import { FabricService } from '../fabric/fabric.service';

const RP_PER_ETH = 10_000_000;
const COMMISSION_RATE = 0.10;      // 판매 수수료 10%
const SELLER_BONUS_RATE = 0.05;    // 수수료 중 판매자에게 RP로 환원 5%
const TOKEN_PCT_MAX = 100;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private ipfsService: IpfsService,
    private productsService: ProductsService,
    private filesService: FilesService,
    private fabric: FabricService,
  ) {}

  // ── 주문 생성 (RP 결제) ────────────────────────────────────────────────────

  async create(buyerId: string, dto: CreateOrderDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { seller: { select: { walletAddress: true } } },
    });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.status !== 'ON_SALE') throw new BadRequestException('구매 불가 상태의 상품입니다');
    if (product.sellerId === buyerId) throw new BadRequestException('본인 상품은 구매할 수 없습니다');

    if (dto.paymentMethod === 'TOSS') {
      throw new BadRequestException('토스 직접 결제는 POST /payments/toss/product 엔드포인트를 이용해주세요');
    }

    const priceRp = product.priceRp ?? Math.ceil(Number(product.priceEth) * RP_PER_ETH);
    const usedPoint = dto.usedPoint ?? 0;
    const autoConfirmAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const payMethodStr = dto.paymentMethod as string;

    if (payMethodStr === 'SQUARE') {
      // Square Wallet 결제: 체인코드 LockEscrow 내부에서 Square 잔액 차감
      if (usedPoint > 0) {
        await this.fabric
          .usePoint(buyerId, usedPoint, `상품 구매 포인트 할인: ${product.title}`)
          .catch(() => {});
      }
    } else if (payMethodStr === 'RP') {
      // 기존 RP 결제 (PointLog 기반) - 레거시 호환
      const balance = await this.getPointBalance(buyerId);
      if (balance < priceRp) throw new BadRequestException('포인트 잔액이 부족합니다');
      await this.deductPoints(buyerId, priceRp, `상품 구매 에스크로 락업: ${product.title}`);
    }
    // TOSS 결제는 PaymentsService.confirmProductPay 에서 주문을 직접 생성

    const order = await this.prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          buyerId,
          productId: dto.productId,
          paymentMethod: dto.paymentMethod,
          amountEth: product.priceEth,
          amountRp: priceRp - usedPoint,
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

    const payMethod = payMethodStr === 'SQUARE' ? 'SQUARE' : 'RP';

    // Fabric 에스크로 락업 (wallet 체인코드)
    await this.fabric
      .lockEscrow(order.id, buyerId, product.sellerId, priceRp, payMethod as 'SQUARE' | 'TOSS', usedPoint, autoConfirmAt)
      .catch(() => {});
    // 불변 거래 원장 기록
    await this.fabric
      .recordTrade(order.id, product.id, buyerId, product.sellerId, priceRp, payMethod)
      .catch(() => {});

    await this.productsService.checkMilestoneBonuses(product.sellerId);

    if (product.mintingTime === 'ON_PURCHASE') {
      this.uploadNftMetadata(product, product.seller.walletAddress);
    }

    return order;
  }

  // ── 구매 확정 (수동) ───────────────────────────────────────────────────────

  async confirm(orderId: string, buyerId: string) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.buyerId !== buyerId) throw new ForbiddenException();
    if (order.status !== 'PENDING_CONFIRMATION') {
      throw new BadRequestException('확정할 수 없는 상태입니다');
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
    });

    await this.settleToSeller(orderId);
    return { success: true, orderId };
  }

  // ── 자동 구매 확정 (스케줄러 호출) ────────────────────────────────────────

  async autoConfirm(orderId: string) {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CONFIRMED', settledAt: new Date() },
    });

    await this.settleToSeller(orderId);
  }

  // ── 정산 로직 ──────────────────────────────────────────────────────────────
  // 판매자에게 90% RP 지급 + 5% RP 보너스 + 토큰 퍼센테이지 +1%

  async settleToSeller(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: { select: { title: true, sellerId: true } } },
    });
    if (!order) return;

    const priceRp = order.amountRp ?? Math.ceil(Number(order.amountEth) * RP_PER_ETH);
    const platformFee = Math.floor(priceRp * COMMISSION_RATE);
    const sellerNet = priceRp - platformFee;             // 90%
    const sellerBonus = Math.floor(priceRp * SELLER_BONUS_RATE); // 5%
    const sellerId = order.product.sellerId;

    await this.prisma.$transaction(async (tx) => {
      const balance = await this.getPointBalance(sellerId, tx);

      await tx.pointLog.create({
        data: {
          userId: sellerId,
          type: 'EARN_SALE',
          amount: sellerNet,
          balance: balance + sellerNet,
          memo: `판매 정산 (90%): ${order.product.title}`,
        },
      });

      await tx.pointLog.create({
        data: {
          userId: sellerId,
          type: 'EARN_BONUS',
          amount: sellerBonus,
          balance: balance + sellerNet + sellerBonus,
          memo: `판매 수수료 환원 보상 (5%): ${order.product.title}`,
        },
      });

      // 토큰 퍼센테이지 +1% (최대 100%)
      const seller = await tx.user.findUnique({ where: { id: sellerId }, select: { tokenPercentage: true } });
      const newPct = Math.min((seller?.tokenPercentage ?? 10) + 1, TOKEN_PCT_MAX);
      await tx.user.update({
        where: { id: sellerId },
        data: { tokenPercentage: newPct },
      });
    });

    // Fabric 에스크로 정산 (wallet 체인코드: Admin Wallet → 판매자 Square Wallet)
    await this.fabric.settleEscrow(orderId).catch(() => {});
    // 판매자 Square Wallet에 판매 수익 적립 기록
    await this.fabric
      .depositSquare(sellerId, sellerNet, `판매 정산 90%: ${order.product.title}`)
      .catch(() => {});
  }

  // ── 다운로드 URL ───────────────────────────────────────────────────────────

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

  // ── 조회 ───────────────────────────────────────────────────────────────────

  async getBuyHistory(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        product: { select: { title: true, fileType: true, imageKey: true, priceEth: true, priceRp: true } },
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
        product: { select: { title: true, priceEth: true, priceRp: true } },
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

  // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

  private async getOrderOrThrow(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다');
    return order;
  }

  async getPointBalance(userId: string, tx?: any): Promise<number> {
    const client = tx ?? this.prisma;
    const latest = await client.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balance ?? 0;
  }

  private async deductPoints(userId: string, amount: number, memo: string) {
    const balance = await this.getPointBalance(userId);
    await this.prisma.pointLog.create({
      data: { userId, type: 'USE_PURCHASE', amount: -amount, balance: balance - amount, memo },
    });
  }

  private uploadNftMetadata(product: any, sellerWallet: string) {
    const metadata = this.ipfsService.buildMetadata({
      title: product.title,
      description: product.description,
      fileType: product.fileType,
      priceEth: product.priceEth.toString(),
      sellerWallet,
      tags: product.tags,
      productId: product.id,
    });
    this.ipfsService.uploadNftMetadata(metadata).then((uri) => {
      if (uri) this.prisma.product.update({ where: { id: product.id }, data: { metadataUri: uri } });
    }).catch(() => {});
  }
}

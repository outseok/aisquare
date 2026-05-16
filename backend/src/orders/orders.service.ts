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
// 수수료 구조 (총 10%)
//   서버(플랫폼): 6%  ← Admin Wallet 귀속
//   판매자 보너스: 2% ← 판매자 Square Wallet 환급
//   구매자 캐시백: 2% ← 구매자 Point Wallet 적립
const PLATFORM_FEE_RATE = 0.06;
const SELLER_BONUS_RATE = 0.02;
const BUYER_CASHBACK_RATE = 0.02;
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
  // 수수료 구조: 서버 6% / 판매자 보너스 2% / 구매자 캐시백 2%
  // 판매자 수령: 90%(수익금) + 2%(보너스) = 92% → Square Wallet
  // 구매자 수령: 2%(캐시백) → Point Wallet
  // 트리거: 구매확정(수동) 또는 72시간 경과(자동)

  async settleToSeller(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        product: { select: { title: true, sellerId: true } },
        buyer: { select: { id: true } },
      },
    });
    if (!order) return;

    const priceRp = order.amountRp ?? Math.ceil(Number(order.amountEth) * RP_PER_ETH);
    const platformFee  = Math.floor(priceRp * PLATFORM_FEE_RATE);   // 서버 6%
    const sellerBonus  = Math.floor(priceRp * SELLER_BONUS_RATE);   // 판매자 2%
    const buyerCashback = Math.floor(priceRp * BUYER_CASHBACK_RATE); // 구매자 2%
    const sellerNet    = priceRp - platformFee - sellerBonus - buyerCashback; // 90%
    const sellerId     = order.product.sellerId;
    const buyerId      = order.buyerId;

    await this.prisma.$transaction(async (tx) => {
      const sellerBalance = await this.getPointBalance(sellerId, tx);

      // 판매자: 수익금 90%
      await tx.pointLog.create({
        data: {
          userId: sellerId,
          type: 'EARN_SALE',
          amount: sellerNet,
          balance: sellerBalance + sellerNet,
          memo: `판매 수익금 (90%): ${order.product.title}`,
        },
      });

      // 판매자: 수수료 환급 2%
      await tx.pointLog.create({
        data: {
          userId: sellerId,
          type: 'EARN_BONUS',
          amount: sellerBonus,
          balance: sellerBalance + sellerNet + sellerBonus,
          memo: `판매자 수수료 환급 (2%): ${order.product.title}`,
        },
      });

      // 구매자: 캐시백 2% → Point Wallet
      const buyerBalance = await this.getPointBalance(buyerId, tx);
      await tx.pointLog.create({
        data: {
          userId: buyerId,
          type: 'EARN_BONUS',
          amount: buyerCashback,
          balance: buyerBalance + buyerCashback,
          memo: `구매 캐시백 (2%): ${order.product.title}`,
        },
      });

      // 토큰 퍼센테이지 +1% (최대 100%)
      const seller = await tx.user.findUnique({ where: { id: sellerId }, select: { tokenPercentage: true } });
      const newPct = Math.min((seller?.tokenPercentage ?? 10) + 1, TOKEN_PCT_MAX);
      await tx.user.update({ where: { id: sellerId }, data: { tokenPercentage: newPct } });
    });

    // Fabric: Admin Wallet → 판매자 Square Wallet 정산 (체인코드: sellerNet + sellerBonus)
    await this.fabric.settleEscrow(orderId).catch(() => {});
    // Fabric: 구매자 Point Wallet 캐시백 적립
    await this.fabric
      .issuePoint(buyerId, buyerCashback, `구매 캐시백 2%: ${order.product.title}`)
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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus } from '@prisma/client';
import { FabricService } from '../fabric/fabric.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  // 신고 목록 (상태별 필터)
  async getReports(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: { select: { walletAddress: true } },
        order: {
          include: {
            product: { select: { title: true, sellerId: true } },
            buyer: { select: { walletAddress: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 신고 상세
  async getReportDetail(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: { walletAddress: true } },
        order: {
          include: {
            product: true,
            buyer: { select: { walletAddress: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('신고를 찾을 수 없습니다');
    return report;
  }

  /**
   * 신고 처리
   * - APPROVED: 판매자 정상 정산 (Order→CONFIRMED) + 토큰 유지
   * - REFUNDED: 구매자 환불 (Order→REFUNDED) + 판매자 토큰 퍼센테이지 0% 초기화
   */
  async processReport(
    reportId: string,
    action: 'REFUNDED' | 'APPROVED',
    adminId: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        order: {
          include: { product: { select: { sellerId: true, title: true } } },
        },
      },
    });
    if (!report) throw new NotFoundException();

    const order = report.order;
    const newOrderStatus = action === 'REFUNDED' ? 'REFUNDED' : 'CONFIRMED';

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: { status: action },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: newOrderStatus,
          settledAt: action === 'APPROVED' ? new Date() : undefined,
        },
      });

      await tx.adminLog.create({
        data: {
          adminId,
          action: `REPORT_${action}`,
          targetId: reportId,
          meta: { orderId: order.id },
        },
      });

      if (action === 'REFUNDED') {
        // 신고 확정 시: 판매자 토큰 퍼센테이지 0%로 초기화
        await tx.user.update({
          where: { id: order.product.sellerId },
          data: { tokenPercentage: 0 },
        });

        // 구매자 RP 환불 (RP 결제인 경우)
        if (order.amountRp) {
          const latest = await tx.pointLog.findFirst({
            where: { userId: order.buyerId },
            orderBy: { createdAt: 'desc' },
          });
          await tx.pointLog.create({
            data: {
              userId: order.buyerId,
              type: 'CONVERT',
              amount: order.amountRp,
              balance: (latest?.balance ?? 0) + order.amountRp,
              memo: `신고 환불: ${order.product.title}`,
            },
          });
        }
      }

      if (action === 'APPROVED') {
        // 판매자 정산 (settleToSeller 로직과 동일)
        await this.settleSellerInTx(tx, order);
      }
    });

    // REFUNDED: Fabric 에스크로 환불 (Square 결제: 구매자 Square Wallet으로 반환, Toss: Toss API 별도 처리)
    if (action === 'REFUNDED') {
      await this.fabric.refundEscrow(order.id).catch(() => {});
    }

    // APPROVED: Fabric 에스크로 정산 (Admin Wallet → 판매자 Square Wallet)
    if (action === 'APPROVED') {
      await this.fabric.settleEscrow(order.id).catch(() => {});
    }

    return { success: true, action };
  }

  // 상품 노출 상태 변경
  async toggleProductVisibility(productId: string, isVisible: boolean, adminId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException();

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id: productId },
        data: { isVisible },
      }),
      this.prisma.adminLog.create({
        data: {
          adminId,
          action: isVisible ? 'PRODUCT_SHOW' : 'PRODUCT_HIDE',
          targetId: productId,
        },
      }),
    ]);

    return { productId, isVisible };
  }

  // 전체 정산 현황
  async getSettlementStats() {
    const [totalOrders, pendingOrders, holdOrders, confirmedOrders, refundedOrders] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          where: { status: 'PENDING_CONFIRMATION' },
          _sum: { amountRp: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'SETTLEMENT_HOLD' },
          _sum: { amountRp: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'CONFIRMED' },
          _sum: { amountRp: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'REFUNDED' },
          _sum: { amountRp: true },
          _count: true,
        }),
      ]);

    return {
      totalOrders,
      pending: { count: pendingOrders._count, totalRp: pendingOrders._sum.amountRp ?? 0 },
      hold: { count: holdOrders._count, totalRp: holdOrders._sum.amountRp ?? 0 },
      confirmed: { count: confirmedOrders._count, totalRp: confirmedOrders._sum.amountRp ?? 0 },
      refunded: { count: refundedOrders._count, totalRp: refundedOrders._sum.amountRp ?? 0 },
    };
  }

  // 전체 상품 목록 (관리자용)
  async getAllProducts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        include: {
          seller: { select: { walletAddress: true, tokenPercentage: true } },
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count(),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // 관리자 로그
  async getAdminLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminLog.count(),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ── 내부 헬퍼: 판매자 정산 (신고 기각 시 tx 내부에서 호출) ─────────────────
  // 수수료 구조: 서버 6% / 판매자 보너스 2% / 구매자 캐시백 2%

  private async settleSellerInTx(tx: any, order: any) {
    const priceRp = order.amountRp ?? 0;
    if (priceRp === 0) return;

    const platformFee   = Math.floor(priceRp * 0.06); // 서버 6%
    const sellerBonus   = Math.floor(priceRp * 0.02); // 판매자 2%
    const buyerCashback = Math.floor(priceRp * 0.02); // 구매자 2%
    const sellerNet     = priceRp - platformFee - sellerBonus - buyerCashback; // 90%
    const sellerId      = order.product.sellerId;
    const buyerId       = order.buyerId;

    const sellerLatest = await tx.pointLog.findFirst({
      where: { userId: sellerId },
      orderBy: { createdAt: 'desc' },
    });
    const sellerBalance = sellerLatest?.balance ?? 0;

    // 판매자: 수익금 90%
    await tx.pointLog.create({
      data: {
        userId: sellerId,
        type: 'EARN_SALE',
        amount: sellerNet,
        balance: sellerBalance + sellerNet,
        memo: `판매 수익금 90% (신고 기각): ${order.product.title}`,
      },
    });

    // 판매자: 수수료 환급 2%
    await tx.pointLog.create({
      data: {
        userId: sellerId,
        type: 'EARN_BONUS',
        amount: sellerBonus,
        balance: sellerBalance + sellerNet + sellerBonus,
        memo: `판매자 수수료 환급 2% (신고 기각): ${order.product.title}`,
      },
    });

    // 구매자: 캐시백 2% → Point Wallet
    const buyerLatest = await tx.pointLog.findFirst({
      where: { userId: buyerId },
      orderBy: { createdAt: 'desc' },
    });
    await tx.pointLog.create({
      data: {
        userId: buyerId,
        type: 'EARN_BONUS',
        amount: buyerCashback,
        balance: (buyerLatest?.balance ?? 0) + buyerCashback,
        memo: `구매 캐시백 2% (신고 기각): ${order.product.title}`,
      },
    });

    const seller = await tx.user.findUnique({
      where: { id: sellerId },
      select: { tokenPercentage: true },
    });
    const newPct = Math.min((seller?.tokenPercentage ?? 10) + 1, 100);
    await tx.user.update({ where: { id: sellerId }, data: { tokenPercentage: newPct } });
  }
}

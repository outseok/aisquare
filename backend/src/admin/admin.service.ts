import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { ReportStatus } from '../common/prisma-enums';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
  ) {}

  async getReports(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      include: {
        reporter: { select: { username: true, name: true } },
        order: {
          include: {
            product: { select: { title: true, sellerId: true } },
            buyer: { select: { username: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReportDetail(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: { username: true, name: true } },
        order: {
          include: {
            product: true,
            buyer: { select: { username: true, name: true } },
          },
        },
      },
    });
    if (!report) throw new NotFoundException('신고를 찾을 수 없습니다');
    return report;
  }

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

    const newOrderStatus = action === 'REFUNDED' ? 'REFUNDED' : 'CONFIRMED';

    await this.prisma.$transaction([
      this.prisma.report.update({
        where: { id: reportId },
        data: { status: action },
      }),
      this.prisma.order.update({
        where: { id: report.orderId },
        data: {
          status: newOrderStatus,
          settledAt: action === 'APPROVED' ? new Date() : undefined,
        },
      }),
      this.prisma.adminLog.create({
        data: {
          adminId,
          action: `REPORT_${action}`,
          targetId: reportId,
          meta: { orderId: report.orderId },
        },
      }),
    ]);

    if (action === 'REFUNDED') {
      await this.tokenService.resetToZero(
        report.order.product.sellerId,
        `신고 확정: ${report.order.product.title}`,
      );
    }

    return { success: true, action };
  }

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

  async getSettlementStats() {
    const [totalOrders, pendingOrders, holdOrders, confirmedOrders, refundedOrders] =
      await Promise.all([
        this.prisma.order.count(),
        this.prisma.order.aggregate({
          where: { status: 'PENDING_CONFIRMATION' },
          _sum: { paymentAmount: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'SETTLEMENT_HOLD' },
          _sum: { paymentAmount: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'CONFIRMED' },
          _sum: { paymentAmount: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'REFUNDED' },
          _sum: { paymentAmount: true },
          _count: true,
        }),
      ]);

    return {
      totalOrders,
      pending: { count: pendingOrders._count, totalKrw:pendingOrders._sum.paymentAmount?.toString() || '0' },
      hold: { count: holdOrders._count, totalKrw:holdOrders._sum.paymentAmount?.toString() || '0' },
      confirmed: { count: confirmedOrders._count, totalKrw:confirmedOrders._sum.paymentAmount?.toString() || '0' },
      refunded: { count: refundedOrders._count, totalKrw:refundedOrders._sum.paymentAmount?.toString() || '0' },
    };
  }

  async getAllProducts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take: limit,
        include: {
          seller: { select: { username: true, name: true } },
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count(),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAdminLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.adminLog.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.adminLog.count(),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ── 사용자 관리 ─────────────────────────────────────────
  async getUsers(q: string | undefined, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where = q
      ? { OR: [
          { username: { contains: q } },
          { email: { contains: q } },
          { nickname: { contains: q } },
          { name: { contains: q } },
        ] }
      : undefined;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, username: true, name: true, nickname: true, email: true, phone: true,
          phoneVerified: true, isAdmin: true, status: true, trustToken: true, createdAt: true,
          _count: { select: { products: true, orders: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'DELETED', adminId: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: status as any },
    });
    await this.prisma.adminLog.create({
      data: { adminId, action: `USER_STATUS_${status}`, targetId: userId, meta: { username: updated.username } },
    });
    return { success: true, user: { id: updated.id, status: updated.status } };
  }

  async adjustTrustToken(userId: string, value: number, reason: string, adminId: string) {
    const v = Math.max(0, Math.min(100, value));
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const prev = user.trustToken;
    const delta = v - prev;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { trustToken: v },
    });
    // tokenLog 기록
    await this.prisma.tokenLog.create({
      data: {
        userId,
        type: delta > 0 ? 'EARN_CONFIRM' : 'DEDUCT_REPORT',
        amount: delta,
        balance: v,
        memo: `[관리자 조정] ${reason}`,
      },
    });
    await this.prisma.adminLog.create({
      data: { adminId, action: 'TRUST_TOKEN_ADJUST', targetId: userId, meta: { prev, next: v, delta, reason } },
    });
    return { success: true, trustToken: updated.trustToken };
  }

  // ── NaverPay 전환 ──────────────────────────────────────
  async getNaverExchanges(status?: string) {
    const where = status ? { status } : undefined;
    return this.prisma.naverPointExchange.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async processNaverExchange(
    id: string,
    body: { action: 'CONFIRMED' | 'REJECTED'; naverTxId?: string; reason?: string },
    adminId: string,
  ) {
    const rec = await this.prisma.naverPointExchange.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('exchange not found');
    if (rec.status !== 'PENDING') throw new NotFoundException(`already processed (${rec.status})`);

    const updated = await this.prisma.naverPointExchange.update({
      where: { id },
      data: {
        status: body.action,
        naverTxId: body.naverTxId ?? null,
        rejectReason: body.action === 'REJECTED' ? (body.reason ?? '관리자 거부') : null,
      },
    });

    // REJECTED면 PAID 포인트 환불
    if (body.action === 'REJECTED') {
      const latest = await this.prisma.pointLog.findFirst({
        where: { userId: rec.userId },
        orderBy: { createdAt: 'desc' },
      });
      await this.prisma.pointLog.create({
        data: {
          userId: rec.userId,
          type: 'NAVER_EXCHANGE_IN',
          category: 'PAID',
          amount: rec.amountPaid,
          balance: (latest?.balance || 0) + rec.amountPaid,
          memo: `네이버페이 전환 거부 환불: ${body.reason ?? '관리자 거부'}`,
          exchangeId: id,
        },
      });
    }

    await this.prisma.adminLog.create({
      data: { adminId, action: `NAVER_EXCHANGE_${body.action}`, targetId: id, meta: body },
    });
    return updated;
  }

  // ── 강제 환불 ──────────────────────────────────────────
  async forceRefund(orderId: string, reason: string, adminId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: { select: { sellerId: true, title: true } } },
    });
    if (!order) throw new NotFoundException('order not found');
    if (order.status === 'REFUNDED') throw new NotFoundException('already refunded');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED' },
    });
    // 판매자 신뢰토큰 페널티 (강제 환불은 신고 인정과 동일)
    try {
      await this.tokenService.resetToZero(order.product.sellerId, `강제 환불: ${order.product.title}`);
    } catch (e) { /* ignore */ }
    await this.prisma.adminLog.create({
      data: { adminId, action: 'FORCE_REFUND', targetId: orderId, meta: { reason, sellerId: order.product.sellerId } },
    });
    return updated;
  }
}

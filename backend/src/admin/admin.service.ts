import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { ReportStatus } from '@prisma/client';

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
}

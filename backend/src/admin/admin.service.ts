import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReportStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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

  // 신고 처리: 환불 또는 정상 지급
  async processReport(
    reportId: string,
    action: 'REFUNDED' | 'APPROVED',
    adminId: string,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { order: true },
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
          _sum: { amountEth: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'SETTLEMENT_HOLD' },
          _sum: { amountEth: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'CONFIRMED' },
          _sum: { amountEth: true },
          _count: true,
        }),
        this.prisma.order.aggregate({
          where: { status: 'REFUNDED' },
          _sum: { amountEth: true },
          _count: true,
        }),
      ]);

    return {
      totalOrders,
      pending: {
        count: pendingOrders._count,
        totalEth: pendingOrders._sum.amountEth?.toString() || '0',
      },
      hold: {
        count: holdOrders._count,
        totalEth: holdOrders._sum.amountEth?.toString() || '0',
      },
      confirmed: {
        count: confirmedOrders._count,
        totalEth: confirmedOrders._sum.amountEth?.toString() || '0',
      },
      refunded: {
        count: refundedOrders._count,
        totalEth: refundedOrders._sum.amountEth?.toString() || '0',
      },
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
          seller: { select: { walletAddress: true } },
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
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { SlackService } from '../slack/slack.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
    private slack: SlackService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoConfirmOrders() {
    const pendingOrders = await this.ordersService.findPendingAutoConfirm();

    if (pendingOrders.length === 0) return;

    this.logger.log(`자동 구매 확정 처리: ${pendingOrders.length}건`);

    for (const order of pendingOrders) {
      try {
        await this.ordersService.autoConfirm(order.id);

        await this.slack.sendSettlementAlert({
          orderId: order.id,
          productTitle: order.product.title,
          sellerName: order.product.seller.name,
          amountEth: order.amountEth.toString(),
        });

        this.logger.log(`자동 확정 완료: 주문 ${order.id}`);
      } catch (err) {
        this.logger.error(`자동 확정 실패: 주문 ${order.id}`, err?.message);
      }
    }
  }

  @Cron('0 0 1 * *')
  async grantMonthlySalesKingBonus() {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const startOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const endOfLastMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);

    const topSeller = await this.prisma.product.groupBy({
      by: ['sellerId'],
      where: {
        status: 'SOLD',
        updatedAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    if (topSeller.length === 0) return;

    const { sellerId } = topSeller[0];
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId: sellerId },
      orderBy: { createdAt: 'desc' },
    });

    await this.prisma.pointLog.create({
      data: {
        userId: sellerId,
        type: 'EARN_BONUS',
        amount: 10000,
        balance: (latest?.balance || 0) + 10000,
        memo: `${lastMonth.getMonth() + 1}월 판매왕 보너스`,
      },
    });

    this.logger.log(`월간 판매왕 보너스 지급: ${sellerId}`);
  }
}

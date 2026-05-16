import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL;

  async sendReportAlert(payload: {
    reportId: string;
    orderId: string;
    productTitle: string;
    sellerInfo: string;
    buyerInfo: string;
    reason: string;
  }) {
    await this.send({
      text: '🚨 새 신고가 접수되었습니다',
      attachments: [
        {
          color: '#FF0000',
          fields: [
            { title: '신고 ID', value: payload.reportId, short: true },
            { title: '주문 ID', value: payload.orderId, short: true },
            { title: '상품명', value: payload.productTitle, short: false },
            { title: '판매자', value: payload.sellerInfo, short: false },
            { title: '구매자(신고자)', value: payload.buyerInfo, short: false },
            { title: '신고 사유', value: payload.reason, short: false },
          ],
          footer: `Recode AI | ${new Date().toISOString()}`,
        },
      ],
    });
  }

  async sendSettlementAlert(payload: {
    orderId: string;
    productTitle: string;
    sellerName: string;
    paymentAmount: number;
  }) {
    await this.send({
      text: '✅ 자동 구매 확정 처리되었습니다',
      attachments: [
        {
          color: '#36A64F',
          fields: [
            { title: '주문 ID', value: payload.orderId, short: true },
            { title: '상품명', value: payload.productTitle, short: true },
            { title: '판매자', value: payload.sellerName, short: false },
            { title: '결제 금액', value: `${payload.paymentAmount.toLocaleString()}원`, short: true },
          ],
          footer: `Recode AI | ${new Date().toISOString()}`,
        },
      ],
    });
  }

  private async send(message: object) {
    if (!this.webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL not set, skipping notification');
      return;
    }
    try {
      await axios.post(this.webhookUrl, message);
    } catch (err) {
      this.logger.error('Slack webhook failed', err?.message);
    }
  }
}

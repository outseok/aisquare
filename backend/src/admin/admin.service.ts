import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { FabricService } from '../fabric/fabric.service';
import { FilesService } from '../files/files.service';
import { ReportStatus } from '../common/prisma-enums';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
    private fabric: FabricService,
    private filesService: FilesService,
  ) {}

  /**
   * Toss Payouts(지급대행) 시뮬레이션.
   * 운영 환경에서는 사업자 계약 후 실 API로 1:1 교체. 응답 형식만 비슷하게 만들어둠.
   *
   *   POST https://api.tosspayments.com/v1/payouts  (실제 엔드포인트는 사업자 가이드 참조)
   *   {
   *     payoutKey: <자체 키>,
   *     bank: <은행 코드>,
   *     accountNumber, accountHolder, amount, ...
   *   }
   */
  private async simulateTossPayouts(
    bankName: string,
    accountNumber: string,
    accountHolder: string,
    amount: number,
    orderId: string,
  ): Promise<string> {
    const payoutKey = `payout_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.logger.log(
      `[TOSS-PAYOUTS-SIM] ${amount.toLocaleString()}원 → ${bankName} ${accountNumber} (${accountHolder}) | order=${orderId} | payoutKey=${payoutKey}`,
    );
    // 모의 지연 — 운영 시 실 API 호출에 들어갈 자리
    await new Promise((r) => setTimeout(r, 150));
    return payoutKey;
  }

  private async signImageKeys(keys: unknown): Promise<string[]> {
    if (!Array.isArray(keys) || keys.length === 0) return [];
    const out: string[] = [];
    for (const k of keys) {
      if (typeof k !== 'string' || !k) continue;
      try {
        out.push(await this.filesService.getPresignedDownloadUrl(k, 3600));
      } catch (e: any) {
        this.logger.warn(`[report-image] sign 실패 key=${k} err=${e?.message}`);
      }
    }
    return out;
  }

  async getReports(status?: ReportStatus) {
    const reports = await this.prisma.report.findMany({
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
    return Promise.all(
      reports.map(async (r) => ({
        ...r,
        imageUrls: await this.signImageKeys(r.imageKeys as unknown as string[]),
      })),
    );
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
    return {
      ...report,
      imageUrls: await this.signImageKeys(report.imageKeys as unknown as string[]),
    };
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

    // REFUNDED 인 경우 결제 수단별 실제 환불 처리
    let refundTxHash: string | undefined;
    if (action === 'REFUNDED') {
      if (report.order.paymentMethod === 'SQUARE') {
        // SQUARE: Fabric 에스크로 환불 (구매자 Square + 사용 포인트 복원)
        try {
          refundTxHash = await this.fabric.refundEscrow(report.orderId);
          this.logger.log(`[REFUND-SQ] escrow refunded order=${report.orderId} tx=${refundTxHash}`);
        } catch (e: any) {
          this.logger.error(`[REFUND-SQ] refundEscrow 실패 order=${report.orderId} err=${e?.message}`);
          throw new NotFoundException('Square 환불 처리 실패: ' + (e?.message || ''));
        }
        // 정산 계좌가 등록돼 있으면, 방금 복원된 Square를 같은 액수만큼 즉시 차감하고
        // Toss Payouts 시뮬레이션으로 계좌로 송금. 결과적으로 Square 잔액은 변동 없음,
        // 거래내역에 "정산 계좌로 환불 송금" 한 줄로 표시되도록 memo에 은행정보 박음.
        const buyer = await this.prisma.user.findUnique({ where: { id: report.order.buyerId } });
        if (buyer?.bankName && buyer?.accountNumber && buyer?.accountHolder) {
          const refundAmount = report.order.paymentAmount;
          const bankMemo = `정산 계좌로 환불 송금: order=${report.orderId} → ${buyer.bankName} ${buyer.accountNumber}`;
          try {
            await this.fabric.deductSquare(buyer.id, refundAmount, bankMemo);
            await this.simulateTossPayouts(
              buyer.bankName, buyer.accountNumber, buyer.accountHolder,
              refundAmount, report.orderId,
            );
            this.logger.log(`[REFUND-SQ-BANK] 정산 계좌 송금 order=${report.orderId} amount=${refundAmount}`);
          } catch (e: any) {
            // 송금 실패 시 Square는 이미 복원돼 있으니 사용자에게는 Square 환불로 남음.
            this.logger.error(`[REFUND-SQ-BANK] 계좌 송금 실패 order=${report.orderId}: ${e?.message}`);
          }
        }
      } else if (report.order.paymentMethod === 'TOSS') {
        // TOSS 결제 환불: 구매자에게 등록 계좌가 있으면 Toss Payouts(지급대행)로 송금 시뮬,
        // 없으면 fallback으로 카드사 cancel API.
        const buyer = await this.prisma.user.findUnique({ where: { id: report.order.buyerId } });
        if (buyer?.bankName && buyer?.accountNumber && buyer?.accountHolder) {
          refundTxHash = await this.simulateTossPayouts(
            buyer.bankName,
            buyer.accountNumber,
            buyer.accountHolder,
            report.order.paymentAmount,
            report.orderId,
          );
        } else {
          const paymentKey = report.order.txHash;
          if (!paymentKey) throw new NotFoundException('Toss paymentKey가 없고 등록 계좌도 없습니다 — 환불 불가');
          const secretKey = process.env.TOSS_SECRET_KEY;
          if (!secretKey) throw new NotFoundException('TOSS_SECRET_KEY 미설정');
          try {
            const auth = Buffer.from(`${secretKey}:`).toString('base64');
            const resp = await axios.post(
              `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
              { cancelReason: `신고 인정 환불: ${report.reason?.slice(0, 60) || '관리자 처리'}` },
              { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' } },
            );
            refundTxHash = resp.data?.cancels?.[0]?.transactionKey || `toss-cancel-${Date.now()}`;
            this.logger.log(`[REFUND-TOSS-CANCEL] order=${report.orderId} tx=${refundTxHash}`);
          } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Toss 환불 호출 실패';
            this.logger.error(`[REFUND-TOSS] 실패 order=${report.orderId}: ${msg}`);
            throw new NotFoundException('Toss 환불 실패: ' + msg);
          }
        }
      }
    }

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
          ...(refundTxHash ? { txHash: refundTxHash } : {}),
        },
      }),
      this.prisma.adminLog.create({
        data: {
          adminId,
          action: `REPORT_${action}`,
          targetId: reportId,
          meta: { orderId: report.orderId, refundTxHash },
        },
      }),
    ]);

    if (action === 'REFUNDED') {
      await this.tokenService.resetToZero(
        report.order.product.sellerId,
        `신고 확정: ${report.order.product.title}`,
      );
    }

    return { success: true, action, refundTxHash };
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

  async getUnreadCount() {
    const [reports, naverExchanges] = await Promise.all([
      this.prisma.report.count({ where: { status: { in: ['PENDING' as any, 'IN_REVIEW' as any] } } }),
      // AISquare 관리자가 처리해야 하는 것 = IN 방향 (NaverPay → AISquare 입금) PENDING만
      this.prisma.naverPointExchange.count({
        where: {
          status: 'PENDING',
          direction: { in: ['NAVER_TO_AISQUARE', 'FROM_NAVER'] },
        },
      }),
    ]);
    return { reports, naverExchanges, total: reports + naverExchanges };
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

  // ── NaverPay → AISquare 입금 처리 (AISquare 관리자 권한) ──────────────────
  // (AISquare → NaverPay 방향은 naver-admin 콘솔에서 NaverPayMSP 신원으로 처리)
  async getNaverExchanges(status?: string) {
    // IN 방향만 보임: 구버전("NAVER_TO_AISQUARE") + 신버전("FROM_NAVER") 둘 다 허용
    const where: any = {
      direction: { in: ['NAVER_TO_AISQUARE', 'FROM_NAVER'] },
    };
    if (status) where.status = status;
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

    const isInbound = rec.direction === 'FROM_NAVER' || rec.direction === 'NAVER_TO_AISQUARE';

    const updated = await this.prisma.naverPointExchange.update({
      where: { id },
      data: {
        status: body.action,
        naverTxId: body.naverTxId ?? null,
        rejectReason: body.action === 'REJECTED' ? (body.reason ?? '관리자 거부') : null,
      },
    });

    if (isInbound) {
      // 네이버 → AISquare 입금: 승인 시 사용자에게 PAID 적립, 거부면 아무 처리 없음
      if (body.action === 'CONFIRMED') {
        const credit = rec.paidPointAmount || Math.floor((rec.naverPointAmount || 0) * (rec.exchangeRate || 0.9));
        if (credit > 0) {
          const latest = await this.prisma.pointLog.findFirst({
            where: { userId: rec.userId },
            orderBy: { createdAt: 'desc' },
          });
          await this.prisma.pointLog.create({
            data: {
              userId: rec.userId,
              type: 'NAVER_EXCHANGE_IN',
              category: 'PAID',
              amount: credit,
              balance: (latest?.balance || 0) + credit,
              memo: `네이버페이 → AISquare 적립: ${rec.naverPointAmount}NP → ${credit}P`,
              exchangeId: id,
            },
          });
          // Fabric naver-channel PAID 잔액도 동기화
          try {
            await this.fabric.issuePaid(rec.userId, credit, `FromNaver ${id}`);
          } catch (e: any) {
            this.logger.warn(`[NAVER-IN] IssuePaid 실패 (체인-DB 불일치): ${e?.message}`);
          }
        }
      }
      // 거부 시: 사용자한테 차감된 게 없으므로 환불 불필요. 그냥 상태만 REJECTED.
    } else {
      // AISquare → 네이버 송금: 거부 시 사용자 PAID 환불 (이미 차감된 상태이므로)
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
            memo: `AISquare → 네이버페이 전환 거부 환불: +${rec.amountPaid.toLocaleString()} P (${body.reason ?? '관리자 거부'})`,
            exchangeId: id,
          },
        });
      }
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

    // SQUARE 결제는 체인코드 RefundEscrow 호출해서 구매자 Square + 사용 포인트 복원
    let refundTxHash: string | undefined;
    if (order.paymentMethod === 'SQUARE') {
      try {
        refundTxHash = await this.fabric.refundEscrow(orderId);
        this.logger.log(`[FORCE-REFUND] escrow refunded order=${orderId} tx=${refundTxHash}`);
      } catch (e: any) {
        this.logger.error(`[FORCE-REFUND] refundEscrow 실패 order=${orderId} err=${e?.message}`);
        throw new NotFoundException('환불 처리 실패: ' + (e?.message || ''));
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDED', ...(refundTxHash ? { txHash: refundTxHash } : {}) },
    });
    // 판매자 신뢰토큰 페널티 (강제 환불은 신고 인정과 동일)
    try {
      await this.tokenService.resetToZero(order.product.sellerId, `강제 환불: ${order.product.title}`);
    } catch (e) { /* ignore */ }
    await this.prisma.adminLog.create({
      data: { adminId, action: 'FORCE_REFUND', targetId: orderId, meta: { reason, sellerId: order.product.sellerId, refundTxHash } },
    });
    return updated;
  }
}

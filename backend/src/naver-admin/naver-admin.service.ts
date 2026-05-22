import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FabricService } from '../fabric/fabric.service';

@Injectable()
export class NaverAdminService {
  private readonly logger = new Logger(NaverAdminService.name);

  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  // AISquare → NaverPay 방향(OUT)만 — naver 관리자가 자기 시스템에 입금 확정해야 하는 케이스
  private outDirectionFilter() {
    return { direction: { in: ['AISQUARE_TO_NAVER', 'TO_NAVER'] } };
  }

  async listExchanges(status?: string) {
    const where: any = { ...this.outDirectionFilter() };
    if (status) where.status = status;
    return this.prisma.naverPointExchange.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async getSummary() {
    const base = this.outDirectionFilter();
    const [pending, confirmed, rejected] = await Promise.all([
      this.prisma.naverPointExchange.count({ where: { ...base, status: 'PENDING' } }),
      this.prisma.naverPointExchange.count({ where: { ...base, status: 'CONFIRMED' } }),
      this.prisma.naverPointExchange.count({ where: { ...base, status: 'REJECTED' } }),
    ]);
    return { pending, confirmed, rejected };
  }

  // 네이버 어드민이 확정 — NaverPayMSP id로 체인코드 직접 호출
  async confirm(exchangeId: string, naverTxId: string | undefined, naverAdminId: string) {
    const rec = await this.prisma.naverPointExchange.findUnique({ where: { id: exchangeId } });
    if (!rec) throw new NotFoundException('전환 요청을 찾을 수 없습니다');
    if (rec.status !== 'PENDING') throw new BadRequestException(`이미 처리된 요청입니다 (${rec.status})`);

    const txId = naverTxId || `naver-${Date.now().toString(36)}`;

    let fabricTx = '';
    try {
      fabricTx = await this.fabric.naverConfirmExchange(exchangeId, txId);
      this.logger.log(`[NaverAdmin] ConfirmNaverExchange ok ex=${exchangeId} fabricTx=${fabricTx}`);
    } catch (e: any) {
      this.logger.error(`[NaverAdmin] ConfirmNaverExchange 실패: ${e?.message}`);
      throw new BadRequestException('Fabric 서명 실패: ' + (e?.message || ''));
    }

    const updated = await this.prisma.naverPointExchange.update({
      where: { id: exchangeId },
      data: { status: 'CONFIRMED', naverTxId: txId, fabricTxId: fabricTx || rec.fabricTxId || null },
    });
    await this.prisma.adminLog.create({
      data: { adminId: naverAdminId, action: 'NAVER_EXCHANGE_CONFIRMED', targetId: exchangeId, meta: { naverTxId: txId, fabricTx } },
    });
    return updated;
  }

  async reject(exchangeId: string, reason: string, naverAdminId: string) {
    const rec = await this.prisma.naverPointExchange.findUnique({ where: { id: exchangeId } });
    if (!rec) throw new NotFoundException('전환 요청을 찾을 수 없습니다');
    if (rec.status !== 'PENDING') throw new BadRequestException(`이미 처리된 요청입니다 (${rec.status})`);

    let fabricTx = '';
    try {
      fabricTx = await this.fabric.naverRejectExchange(exchangeId, reason || '한도 초과');
    } catch (e: any) {
      this.logger.error(`[NaverAdmin] RejectNaverExchange 실패: ${e?.message}`);
      throw new BadRequestException('Fabric 거부 실패: ' + (e?.message || ''));
    }

    // PAID 포인트 환불
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
        memo: `AISquare → 네이버페이 전환 거부 환불: +${rec.amountPaid.toLocaleString()} P (${reason || '네이버 어드민 거부'})`,
        exchangeId,
      },
    });

    const updated = await this.prisma.naverPointExchange.update({
      where: { id: exchangeId },
      data: { status: 'REJECTED', rejectReason: reason || '네이버 어드민 거부' },
    });
    await this.prisma.adminLog.create({
      data: { adminId: naverAdminId, action: 'NAVER_EXCHANGE_REJECTED', targetId: exchangeId, meta: { reason, fabricTx } },
    });
    return updated;
  }
}

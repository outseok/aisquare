import {
  Injectable, BadRequestException, UnauthorizedException, Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { FabricService } from '../fabric/fabric.service';
import { ExchangeToNaverDto } from './dto/exchange-to-naver.dto';
import { ExchangeFromNaverDto } from './dto/exchange-from-naver.dto';

/**
 * 네이버페이 ↔ AI Square 포인트 교환 서비스
 *
 * 규칙:
 *   - PAID 포인트만 네이버페이로 전환 가능 (돈 충전으로 얻은 포인트)
 *   - ACTIVITY 포인트는 전환 불가 (리뷰, 캐시백 등으로 얻은 포인트)
 *   - 네이버페이 포인트 → AI Square는 항상 PAID로 전환됨
 *   - 교환 내역은 naver-channel에 기록 (네이버와 공유)
 *
 * 교환 비율: 1:1 (1 AI Square Point = 1 NaverPay Point = 1원)
 *
 * 가상 키(데모) 흐름:
 *   NAVERPAY_ENABLED=false (기본값) + NAVERPAY_DEMO_KEY=<임의 시크릿> 설정 시
 *   실제 NaverPay API 없이도 전환 흐름을 시연할 수 있습니다.
 *   - TO_NAVER: 가상 naverTxId 자동 생성 + Fabric DemoConfirmExchange 호출
 *   - FROM_NAVER: X-NaverPay-Demo-Key 헤더 검증 후 PAID 포인트 적립
 */

const MIN_EXCHANGE = 100;
const EXCHANGE_RATE = 0.9; // 양방향 0.9:1 (네이버↔AISquare)

@Injectable()
export class NaverExchangeService {
  private readonly logger = new Logger(NaverExchangeService.name);
  private readonly isDemo = process.env.NAVERPAY_ENABLED !== 'true';

  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  // ── 잔액 조회 ─────────────────────────────────────────────────────────────

  async getPointSummary(userId: string) {
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const totalBalance = latest?.balance ?? 0;
    const paidBalance = latest?.paidBalance ?? 0;
    const activityBalance = totalBalance - paidBalance;

    return {
      totalBalance,
      paidBalance,
      activityBalance,
      exchangeNote: `유료 포인트(${paidBalance}P)만 네이버페이로 전환 가능합니다`,
      demoMode: this.isDemo,
    };
  }

  // ── AI Square 유료 포인트 → 네이버페이 ────────────────────────────────────

  async exchangeToNaver(userId: string, dto: ExchangeToNaverDto) {
    if (dto.amount < MIN_EXCHANGE) {
      throw new BadRequestException(`최소 교환 수량은 ${MIN_EXCHANGE}P 입니다`);
    }

    const latest = await this.getLatestLog(userId);
    const paidBalance = latest?.paidBalance ?? 0;
    const totalBalance = latest?.balance ?? 0;

    if (paidBalance < dto.amount) {
      throw new BadRequestException(
        `유료 포인트 잔액 부족. 전환 가능: ${paidBalance}P (전체 보유: ${totalBalance}P 중 활동 포인트 ${totalBalance - paidBalance}P는 전환 불가)`,
      );
    }

    const naverPointAmount = Math.floor(dto.amount * EXCHANGE_RATE);

    const exchange = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.naverPointExchange.create({
        data: {
          userId,
          direction: 'TO_NAVER',
          paidPointAmount: dto.amount,
          naverPointAmount,
          exchangeRate: EXCHANGE_RATE,
          status: 'PENDING',
        },
      });

      await tx.pointLog.create({
        data: {
          userId,
          type: 'NAVER_EXCHANGE_OUT',
          category: 'PAID',
          amount: -dto.amount,
          balance: totalBalance - dto.amount,
          paidBalance: paidBalance - dto.amount,
          memo: `AISquare → 네이버페이 전환: ${dto.amount.toLocaleString()} P → ${naverPointAmount.toLocaleString()} NP`,
        },
      });

      return rec;
    });

    // 네이버페이 포인트 지급 (실제 API or 데모 시뮬레이션)
    let naverTxId: string;
    if (this.isDemo) {
      naverTxId = `demo-naver-${uuidv4()}`;
      this.logger.log(
        `[NaverExchange-Demo] 네이버페이 ${naverPointAmount}P 지급 시뮬레이션 | userId=${userId} naverTxId=${naverTxId}`,
      );
    } else {
      naverTxId = await this.callNaverCreditPoint(userId, naverPointAmount);
    }

    await this.prisma.naverPointExchange.update({
      where: { id: exchange.id },
      data: { status: 'COMPLETED', naverTxId },
    });

    // Fabric 기록: 데모 모드면 가상 키로 DemoConfirmExchange, 실제면 recordNaverExchange
    const fabricTxId = await this.writeFabricToNaver(exchange.id, userId, dto.amount, naverPointAmount, naverTxId);

    await this.prisma.naverPointExchange.update({
      where: { id: exchange.id },
      data: { fabricTxId },
    });

    return {
      success: true,
      exchangeId: exchange.id,
      deductedPaidPoint: dto.amount,
      naverPointCredited: naverPointAmount,
      remainingPaidBalance: paidBalance - dto.amount,
      remainingTotalBalance: totalBalance - dto.amount,
      naverTxId,
      fabricTxId,
      demoMode: this.isDemo,
      message: `유료 포인트 ${dto.amount}P → 네이버페이 ${naverPointAmount}P 전환 완료`,
    };
  }

  // ── 네이버페이 → AI Square 유료 포인트 (일반 사용자 요청) ─────────────────

  async exchangeFromNaver(userId: string, dto: ExchangeFromNaverDto) {
    if (dto.amount < MIN_EXCHANGE) {
      throw new BadRequestException(`최소 교환 수량은 ${MIN_EXCHANGE}P 입니다`);
    }

    const duplicate = await this.prisma.naverPointExchange.findFirst({
      where: { naverTxId: dto.naverTxId, direction: 'FROM_NAVER' },
    });
    if (duplicate) {
      throw new BadRequestException('이미 처리된 네이버페이 트랜잭션입니다');
    }

    if (!this.isDemo) {
      await this.verifyNaverDeduction(dto.naverTxId, dto.amount);
    } else {
      this.logger.log(
        `[NaverExchange-Demo] 네이버페이 ${dto.amount}P 차감 검증 시뮬레이션 | naverTxId=${dto.naverTxId}`,
      );
    }

    return this.creditFromNaver(userId, dto.amount, dto.naverTxId);
  }

  // ── 데모 전용: 가상 키로 NaverPay → AI Square 전환 ────────────────────────

  async demoFromNaver(demoKey: string, userId: string, amount: number, naverTxId: string) {
    this.validateDemoKey(demoKey);

    if (amount < MIN_EXCHANGE) {
      throw new BadRequestException(`최소 교환 수량은 ${MIN_EXCHANGE}P 입니다`);
    }

    const duplicate = await this.prisma.naverPointExchange.findFirst({
      where: { naverTxId, direction: 'FROM_NAVER' },
    });
    if (duplicate) {
      throw new BadRequestException('이미 처리된 naverTxId 입니다');
    }

    this.logger.log(
      `[NaverExchange-Demo] 가상 키 인증 성공 — NaverPay ${amount}P 전환 요청 | userId=${userId} naverTxId=${naverTxId}`,
    );

    return this.creditFromNaver(userId, amount, naverTxId);
  }

  // ── 관리자 전용: 체인코드 가상 키 등록 ──────────────────────────────────────

  async initChaincodeDemoKey() {
    const key = this.getDemoKey();
    const fabricTxId = await this.fabric.setDemoNaverKey(key).catch((e) => {
      this.logger.warn('SetDemoNaverKey Fabric 호출 실패 (무시)', e?.message);
      return 'fabric-demo';
    });
    return { success: true, fabricTxId };
  }

  // ── 교환 내역 조회 ────────────────────────────────────────────────────────

  async getExchangeHistory(userId: string) {
    const records = await this.prisma.naverPointExchange.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return records.map((r) => ({
      ...r,
      directionLabel: r.direction === 'TO_NAVER' ? 'AI Square → 네이버페이' : '네이버페이 → AI Square',
    }));
  }

  // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

  private async creditFromNaver(userId: string, amount: number, naverTxId: string) {
    const aiPointAmount = Math.floor(amount * EXCHANGE_RATE);
    const latest = await this.getLatestLog(userId);
    const currentTotal = latest?.balance ?? 0;
    const currentPaid = latest?.paidBalance ?? 0;

    const exchange = await this.prisma.$transaction(async (tx) => {
      const rec = await tx.naverPointExchange.create({
        data: {
          userId,
          direction: 'FROM_NAVER',
          paidPointAmount: aiPointAmount,
          naverPointAmount: amount,
          exchangeRate: EXCHANGE_RATE,
          status: 'COMPLETED',
          naverTxId,
        },
      });

      await tx.pointLog.create({
        data: {
          userId,
          type: 'NAVER_EXCHANGE_IN',
          category: 'PAID',
          amount: aiPointAmount,
          balance: currentTotal + aiPointAmount,
          paidBalance: currentPaid + aiPointAmount,
          memo: `네이버페이 → AISquare 적립: ${amount.toLocaleString()} NP → ${aiPointAmount.toLocaleString()} P`,
        },
      });

      return rec;
    });

    // Fabric: 가상 키 또는 실제 기록
    const fabricTxId = await this.fabric
      .recordFromNaver(exchange.id, userId, naverTxId, aiPointAmount, this.getDemoKey())
      .catch((e) => {
        this.logger.warn('Fabric recordFromNaver 실패 (무시)', e?.message);
        return 'fabric-demo';
      });

    await this.prisma.naverPointExchange.update({
      where: { id: exchange.id },
      data: { fabricTxId },
    });

    return {
      success: true,
      exchangeId: exchange.id,
      naverPointDeducted: amount,
      paidPointCredited: aiPointAmount,
      newPaidBalance: currentPaid + aiPointAmount,
      newTotalBalance: currentTotal + aiPointAmount,
      fabricTxId,
      message: `네이버페이 ${amount}P → AI Square 유료 포인트 ${aiPointAmount}P 전환 완료`,
    };
  }

  private async writeFabricToNaver(
    exchangeId: string, userId: string,
    paidAmount: number, naverAmount: number, naverTxId: string,
  ): Promise<string> {
    const demoKey = this.getDemoKey();
    if (this.isDemo && demoKey) {
      // 체인코드의 ExchangeToNaver(PAID 차감)는 이미 완료됐으므로
      // DemoConfirmExchange로 PENDING → CONFIRMED 처리
      return this.fabric
        .demoConfirmNaverExchange(exchangeId, naverTxId, demoKey)
        .catch((e) => {
          this.logger.warn('Fabric DemoConfirmExchange 실패 (무시)', e?.message);
          return 'fabric-demo';
        });
    }
    return this.fabric
      .recordNaverExchange(exchangeId, userId, 'TO_NAVER', paidAmount, naverAmount, naverTxId)
      .catch((e) => {
        this.logger.warn('Fabric recordNaverExchange 실패 (무시)', e?.message);
        return 'fabric-demo';
      });
  }

  private getDemoKey(): string {
    return process.env.NAVERPAY_DEMO_KEY ?? '';
  }

  private validateDemoKey(provided: string) {
    const key = this.getDemoKey();
    if (!key) {
      throw new BadRequestException('NAVERPAY_DEMO_KEY 환경변수가 설정되지 않았습니다');
    }
    if (provided !== key) {
      throw new UnauthorizedException('가상 NaverPay 키가 올바르지 않습니다');
    }
  }

  private async getLatestLog(userId: string) {
    return this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async callNaverCreditPoint(userId: string, amount: number): Promise<string> {
    this.logger.warn('[NaverExchange] 실제 NaverPay 포인트 지급 API — 계약 체결 후 활성화 필요');
    return `naver-credit-${uuidv4()}`;
  }

  private async verifyNaverDeduction(naverTxId: string, amount: number): Promise<void> {
    this.logger.warn('[NaverExchange] 실제 NaverPay 포인트 차감 검증 API — 계약 체결 후 활성화 필요');
  }
}

import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { FabricService } from '../fabric/fabric.service';
import { RequestSquareChargeDto, ConfirmSquareChargeDto } from './dto/charge-square.dto';

// 1 Square = 1 KRW (1:1 페깅)
// Toss 결제 단위는 원화 그대로 사용
const REVIEW_POINT_BONUS = 20;        // 리뷰 작성 보상 20 포인트
const CHARGE_BONUS_RATE = 0.0001;     // 충전 금액의 0.01% 포인트 적립

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly tossBaseUrl = 'https://api.tosspayments.com/v1';

  constructor(
    private prisma: PrismaService,
    private fabric: FabricService,
  ) {}

  // ── Square Wallet ──────────────────────────────────────────────────────────

  /** Square Wallet 잔액 조회 */
  async getSquareBalance(userId: string) {
    if (this.fabric.useFabric) {
      const balance = await this.fabric.getSquareBalance(userId);
      return { balance, unit: 'KRW', walletType: 'SQUARE' };
    }
    // 데모 모드: PointLog에서 CHARGE 합산으로 근사값 반환
    const balance = await this.getPointLogBalance(userId);
    return { balance, unit: 'KRW', walletType: 'SQUARE', note: 'demo-mode' };
  }

  /** Square Wallet 거래 내역 */
  async getSquareHistory(userId: string) {
    if (this.fabric.useFabric) {
      const items = await this.fabric.getSquareHistory(userId);
      return { items, walletType: 'SQUARE' };
    }
    // 데모 모드: PointLog에서 반환
    const items = await this.prisma.pointLog.findMany({
      where: { userId, type: { in: ['CHARGE', 'CHARGE_BONUS', 'EARN_SALE', 'EARN_BONUS', 'USE_PURCHASE', 'WITHDRAW'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { items, walletType: 'SQUARE', note: 'demo-mode' };
  }

  /** Square Wallet 충전 요청 — Toss 결제창 파라미터 반환 */
  async requestSquareCharge(userId: string, dto: RequestSquareChargeDto) {
    const tossOrderId = `sq-${uuidv4()}`;

    await this.prisma.tossPayment.create({
      data: {
        userId,
        tossOrderId,
        amount: dto.amount,
        purpose: 'RP_CHARGE',  // DB enum 호환: RP_CHARGE = Square 충전
        status: 'PENDING',
        rpGranted: dto.amount, // 1:1 페깅
      },
    });

    return {
      tossOrderId,
      amount: dto.amount,
      orderName: `Recode AI Square Wallet 충전 ${dto.amount.toLocaleString()}원`,
      clientKey: process.env.TOSS_CLIENT_KEY,
    };
  }

  /** Square Wallet 충전 확인 — Toss 결제 완료 후 Square Wallet에 적립 */
  async confirmSquareCharge(userId: string, dto: ConfirmSquareChargeDto) {
    const record = await this.prisma.tossPayment.findUnique({
      where: { tossOrderId: dto.orderId },
    });
    if (!record) throw new NotFoundException('결제 정보를 찾을 수 없습니다');
    if (record.userId !== userId) throw new BadRequestException('본인 결제만 처리 가능합니다');
    if (record.status !== 'PENDING') throw new BadRequestException('이미 처리된 결제입니다');
    if (record.amount !== dto.amount) throw new BadRequestException('결제 금액이 일치하지 않습니다');

    await this.confirmWithToss(dto.paymentKey, dto.orderId, dto.amount);

    const chargeAmount = record.rpGranted!; // = dto.amount (1:1 페깅)
    const bonusPoint = Math.floor(dto.amount * CHARGE_BONUS_RATE);

    await this.prisma.$transaction(async (tx) => {
      await tx.tossPayment.update({
        where: { tossOrderId: dto.orderId },
        data: { paymentKey: dto.paymentKey, status: 'CONFIRMED' },
      });

      // 데모 모드 대비 PointLog에도 기록
      const balance = await this.getPointLogBalance(userId, tx);
      await tx.pointLog.create({
        data: {
          userId,
          type: 'CHARGE',
          amount: chargeAmount,
          balance: balance + chargeAmount,
          memo: `Square Wallet 충전 ${dto.amount.toLocaleString()}원`,
        },
      });

      if (bonusPoint > 0) {
        const afterCharge = balance + chargeAmount;
        await tx.pointLog.create({
          data: {
            userId,
            type: 'CHARGE_BONUS',
            amount: bonusPoint,
            balance: afterCharge + bonusPoint,
            memo: `충전 보너스 포인트 ${bonusPoint}P`,
          },
        });
      }
    });

    // Fabric Square Wallet 적립
    await this.fabric
      .depositSquare(userId, chargeAmount, `Toss 충전 ${dto.orderId}`)
      .catch((e) => this.logger.warn('Fabric depositSquare 실패 (무시)', e?.message));

    // Fabric Point Wallet 보너스 포인트 적립
    if (bonusPoint > 0) {
      await this.fabric
        .issuePoint(userId, bonusPoint, `충전 보너스 포인트 ${dto.orderId}`)
        .catch((e) => this.logger.warn('Fabric issuePoint 실패 (무시)', e?.message));
    }

    return {
      success: true,
      charged: chargeAmount,
      bonusPoint,
      message: `Square Wallet에 ${chargeAmount.toLocaleString()}원이 충전되었습니다`,
    };
  }

  // ── Point Wallet ───────────────────────────────────────────────────────────

  /** Point Wallet 잔액 조회 */
  async getPointBalance(userId: string) {
    if (this.fabric.useFabric) {
      const balance = await this.fabric.getPointBalance(userId);
      return { balance, unit: 'Point', walletType: 'POINT' };
    }
    // 데모 모드: PointLog에서 REVIEW_BONUS 합산
    const logs = await this.prisma.pointLog.findMany({
      where: { userId, type: { in: ['REVIEW_BONUS', 'CHARGE_BONUS'] } },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const balance = logs[0]?.balance ?? 0;
    return { balance, unit: 'Point', walletType: 'POINT', note: 'demo-mode' };
  }

  /** Point Wallet 거래 내역 */
  async getPointHistory(userId: string) {
    if (this.fabric.useFabric) {
      const items = await this.fabric.getPointHistory(userId);
      return { items, walletType: 'POINT' };
    }
    const items = await this.prisma.pointLog.findMany({
      where: { userId, type: { in: ['REVIEW_BONUS', 'CHARGE_BONUS'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { items, walletType: 'POINT', note: 'demo-mode' };
  }

  /**
   * 리뷰 작성 시 Point Wallet 보상 적립 (ReviewsService에서 호출)
   * Fabric이 활성화된 경우 체인코드에 기록, 항상 DB에도 기록
   */
  async grantReviewBonus(userId: string) {
    const balance = await this.getPointLogBalance(userId);
    await this.prisma.pointLog.create({
      data: {
        userId,
        type: 'REVIEW_BONUS',
        amount: REVIEW_POINT_BONUS,
        balance: balance + REVIEW_POINT_BONUS,
        memo: '리뷰 작성 보상',
      },
    });

    await this.fabric
      .issuePoint(userId, REVIEW_POINT_BONUS, '리뷰 작성 보상')
      .catch((e) => this.logger.warn('Fabric issuePoint(review) 실패 (무시)', e?.message));
  }

  // ── Admin Wallet / Escrow 조회 ─────────────────────────────────────────────

  /** 에스크로 상태 조회 */
  async getEscrowState(orderId: string, requesterId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { product: { select: { sellerId: true } } },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다');
    if (order.buyerId !== requesterId && order.product.sellerId !== requesterId) {
      throw new BadRequestException('조회 권한이 없습니다');
    }

    const fabricState = await this.fabric
      .getEscrowState(orderId)
      .catch(() => null);

    return {
      orderId,
      orderStatus: order.status,
      autoConfirmAt: order.autoConfirmAt,
      paymentMethod: order.paymentMethod,
      amount: order.amountRp,
      fabricState,
    };
  }

  // ── Toss API 헬퍼 ──────────────────────────────────────────────────────────

  private async confirmWithToss(paymentKey: string, orderId: string, amount: number) {
    const secretKey = process.env.TOSS_SECRET_KEY!;
    const encoded = Buffer.from(`${secretKey}:`).toString('base64');
    try {
      const { data } = await axios.post(
        `${this.tossBaseUrl}/payments/confirm`,
        { paymentKey, orderId, amount },
        { headers: { Authorization: `Basic ${encoded}`, 'Content-Type': 'application/json' } },
      );
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.message ?? '토스 결제 승인 실패';
      this.logger.error('Toss confirm error', err.response?.data);
      throw new BadRequestException(msg);
    }
  }

  private async getPointLogBalance(userId: string, tx?: any): Promise<number> {
    const client = tx ?? this.prisma;
    const latest = await client.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balance ?? 0;
  }
}

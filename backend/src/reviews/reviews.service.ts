import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

const SELLER_5STAR_BONUS = 50; // 판매자 5점 수신 보너스 RP
const TOKEN_PCT_MAX = 100;

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private walletService: WalletService,
  ) {}

  async create(reviewerId: string, orderId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { review: true, product: { select: { id: true, sellerId: true, title: true } } },
    });
    if (!order) throw new NotFoundException('주문을 찾을 수 없습니다');
    if (order.buyerId !== reviewerId) throw new ForbiddenException('구매자만 리뷰를 작성할 수 있습니다');
    if (order.status !== 'CONFIRMED') throw new BadRequestException('구매 확정 후 리뷰 작성이 가능합니다');
    if (order.review) throw new BadRequestException('이미 리뷰를 작성하셨습니다');

    const review = await this.prisma.review.create({
      data: {
        orderId,
        productId: order.productId,
        reviewerId,
        rating: dto.rating,
        content: dto.content,
      },
    });

    // 구매자 리뷰 작성 보상 20 Point (Point Wallet 적립 + Fabric 기록)
    await this.walletService.grantReviewBonus(reviewerId);

    // 판매자 토큰 퍼센테이지 및 RP 보상 처리
    await this.applySellerRatingEffects(order.product.sellerId, dto.rating, order.product.title);

    return review;
  }

  async update(reviewId: string, userId: string, dto: UpdateReviewDto) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('리뷰를 찾을 수 없습니다');
    if (review.reviewerId !== userId) throw new ForbiddenException('본인 리뷰만 수정할 수 있습니다');

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.content && { content: dto.content }),
      },
    });
  }

  async remove(reviewId: string, userId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('리뷰를 찾을 수 없습니다');
    if (review.reviewerId !== userId) throw new ForbiddenException('본인 리뷰만 삭제할 수 있습니다');

    return this.prisma.review.delete({ where: { id: reviewId } });
  }

  async findByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId },
      include: { reviewer: { select: { walletAddress: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── 내부 헬퍼 ─────────────────────────────────────────────────────────────

  /** 판매자: 별점에 따라 토큰 퍼센테이지 조정 + 5점 시 RP 보너스 */
  private async applySellerRatingEffects(sellerId: string, rating: number, productTitle: string) {
    const seller = await this.prisma.user.findUnique({ where: { id: sellerId }, select: { tokenPercentage: true } });
    let pct = seller?.tokenPercentage ?? 10;

    if (rating === 5) {
      // 토큰 퍼센테이지 +0.5% (소수점은 정수 저장이므로 1% 단위로 반올림 처리)
      // DB 필드가 Int이므로: 0.5% 적용은 2회마다 +1 처리 → 별도 관리 어려우므로 round 처리
      pct = Math.min(pct + 1, TOKEN_PCT_MAX); // 편의상 5점 수신 시 +1% 반올림

      const latest = await this.prisma.pointLog.findFirst({
        where: { userId: sellerId },
        orderBy: { createdAt: 'desc' },
      });
      const balance = (latest?.balance ?? 0) + SELLER_5STAR_BONUS;
      await this.prisma.pointLog.create({
        data: {
          userId: sellerId,
          type: 'EARN_BONUS',
          amount: SELLER_5STAR_BONUS,
          balance,
          memo: `5점 리뷰 수신 보너스: ${productTitle}`,
        },
      });
    } else if (rating <= 2) {
      // 토큰 퍼센테이지 -0.5% → 정수 저장이므로 -1% 반올림, 최솟값 0
      pct = Math.max(pct - 1, 0);
    }

    await this.prisma.user.update({
      where: { id: sellerId },
      data: { tokenPercentage: pct },
    });
  }
}

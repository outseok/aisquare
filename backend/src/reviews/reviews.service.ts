import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from '../token/token.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private tokenService: TokenService,
  ) {}

  async create(reviewerId: string, orderId: string, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        review: true,
        product: { select: { sellerId: true } },
      },
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

    const sellerId = order.product.sellerId;

    if (dto.rating === 5) {
      await this.grant5StarBonus(order.productId);
      await this.tokenService.grant(sellerId, 0.5, 'EARN_REVIEW_5', '5점 리뷰 수신');
    } else if (dto.rating <= 2) {
      await this.tokenService.deduct(sellerId, 0.5, 'DEDUCT_REVIEW_LOW', `${dto.rating}점 리뷰 수신`);
    }

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
      include: { reviewer: { select: { username: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async grant5StarBonus(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;

    const latest = await this.prisma.pointLog.findFirst({
      where: { userId: product.sellerId },
      orderBy: { createdAt: 'desc' },
    });
    const balance = (latest?.balance || 0) + 50;
    await this.prisma.pointLog.create({
      data: {
        userId: product.sellerId,
        type: 'EARN_BONUS',
        amount: 50,
        balance,
        memo: '5점 리뷰 수신 보너스',
      },
    });
  }
}

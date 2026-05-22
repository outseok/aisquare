import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto, SortOrder } from './dto/query-product.dto';
import { FileType } from '../common/prisma-enums';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private filesService: FilesService,
  ) {}

  /**
   * imageKey → 클라이언트가 바로 <img src>로 쓸 수 있는 URL.
   * - "assets/..." : 시드 데이터 (정적 자산) → null (frontend가 ./assets/cover-XX.svg fallback)
   * - "uploads/..." : S3 업로드 자산 → CloudFront signed URL (1시간)
   */
  private async resolveImageUrl(imageKey: string | null | undefined): Promise<string | null> {
    if (!imageKey) return null;
    if (imageKey.startsWith('assets/')) return null;
    try {
      return await this.filesService.getPresignedDownloadUrl(imageKey, 3600);
    } catch (e) {
      return null;
    }
  }

  async create(
    sellerId: string,
    dto: CreateProductDto,
    fileKey: string,
    fileType: FileType,
    imageKey?: string,
  ) {
    const product = await this.prisma.product.create({
      data: {
        sellerId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        tags: dto.tags || [],
        fileKey,
        fileType,
        imageKey,
      },
    });

    await this.grantFirstProductBonus(sellerId);
    return product;
  }

  private async grantFirstProductBonus(sellerId: string) {
    const count = await this.prisma.product.count({ where: { sellerId } });
    if (count === 1) {
      await this.addPointBonus(sellerId, 500, '첫 상품 등록 보너스');
    }
  }

  async findAll(query: QueryProductDto) {
    const { search, fileType, sort, page, limit, includeSold, sellerUsername } = query;
    const skip = ((page || 1) - 1) * (limit || 20);

    // 기본: ON_SALE만 (마켓·홈에서 SOLD 숨김).
    // includeSold=1 또는 sellerUsername 지정 시(판매자 페이지)엔 SOLD도 포함.
    const showSold = includeSold === '1' || includeSold === 'true' || !!sellerUsername;
    const where: Prisma.ProductWhereInput = {
      isVisible: true,
      status: { in: showSold ? ['ON_SALE', 'SOLD'] : ['ON_SALE'] },
      ...(fileType && { fileType }),
      ...(sellerUsername && { seller: { is: { username: sellerUsername } } }),
      ...(search && {
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { tags: { string_contains: search } as any },
          { seller: { is: { OR: [
            { name: { contains: search } },
            { username: { contains: search } },
            { nickname: { contains: search } },
          ] } } },
        ],
      }),
    };

    let orderBy: Prisma.ProductOrderByWithRelationInput;
    switch (sort) {
      case SortOrder.REVIEWS:
      case SortOrder.RATING:
        orderBy = { reviews: { _count: 'desc' } };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit || 20,
        include: {
          seller: { select: { username: true, name: true } },
          _count: { select: { reviews: true } },
          reviews: { select: { rating: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const mapped = await Promise.all(
      items.map(async (p) => ({
        ...p,
        avgRating:
          p.reviews.length > 0
            ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
            : 0,
        reviewCount: p._count.reviews,
        imageUrl: await this.resolveImageUrl(p.imageKey),
        reviews: undefined,
        _count: undefined,
      })),
    );
    return {
      items: mapped,
      total,
      page: page || 1,
      totalPages: Math.ceil(total / (limit || 20)),
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        seller: { select: { username: true, name: true } },
        reviews: {
          include: { reviewer: { select: { username: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');

    await this.prisma.product.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0;

    return {
      ...product,
      avgRating,
      reviewCount: product._count.reviews,
      imageUrl: await this.resolveImageUrl(product.imageKey),
      _count: undefined,
    };
  }

  /**
   * 판매자 랭킹 — 판매 수 / 별점 / 신뢰토큰 / 매출 가중 점수
   * score = sold×120 + ratingWeighted×40 + trust×3 + revenue/1000 + reviewCount×1
   * (별점은 리뷰 5건 미만이면 가중치 절반)
   */
  async getSellersRanking(limit = 50) {
    const sellers = await this.prisma.user.findMany({
      where: { products: { some: {} }, status: 'ACTIVE', isAdmin: false },
      select: {
        id: true,
        username: true,
        name: true,
        nickname: true,
        trustToken: true,
        createdAt: true,
        products: {
          select: { id: true, status: true, _count: { select: { reviews: true } } },
        },
      },
    });

    const rows = await Promise.all(
      sellers.map(async (s) => {
        const productCount = s.products.length;
        const soldCount = s.products.filter((p) => p.status === 'SOLD').length;
        const reviewCount = s.products.reduce((a, p) => a + p._count.reviews, 0);

        const reviews = await this.prisma.review.findMany({
          where: { product: { sellerId: s.id } },
          select: { rating: true },
        });
        const avgRating =
          reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
            : 0;

        // 확정·정산 완료된 주문의 결제 금액 합 (매출)
        const revenueAgg = await this.prisma.order.aggregate({
          where: {
            product: { sellerId: s.id },
            status: { in: ['CONFIRMED', 'PENDING_CONFIRMATION', 'SETTLEMENT_HOLD'] },
          },
          _sum: { paymentAmount: true },
        });
        const revenue = Number(revenueAgg._sum.paymentAmount || 0);

        const ratingWeighted = reviewCount >= 5 ? avgRating : avgRating * 0.5;
        const score =
          soldCount * 120 +
          ratingWeighted * 40 +
          (s.trustToken || 0) * 3 +
          revenue / 1000 +
          reviewCount * 1;

        return {
          username: s.username,
          name: s.name,
          nickname: s.nickname,
          trustToken: Number((s.trustToken || 0).toFixed(1)),
          tokenPct: Math.max(0, Math.min(100, (s.trustToken || 0) * 10)),
          productCount,
          sold: soldCount,
          reviewCount,
          rating: Number(avgRating.toFixed(2)),
          revenue,
          joinedAt: s.createdAt,
          score: Number(score.toFixed(2)),
        };
      }),
    );

    rows.sort(
      (a, b) =>
        b.score - a.score ||
        b.sold - a.sold ||
        b.rating - a.rating ||
        b.trustToken - a.trustToken,
    );

    return { items: rows.slice(0, limit), total: rows.length };
  }

  async getSellerStats(username: string) {
    const seller = await this.prisma.user.findUnique({
      where: { username },
      include: {
        products: { where: { status: 'SOLD' }, select: { id: true } },
      },
    });
    if (!seller) throw new NotFoundException('판매자를 찾을 수 없습니다');

    const reviews = await this.prisma.review.findMany({
      where: { product: { sellerId: seller.id } },
      select: { rating: true },
    });

    return {
      username: seller.username,
      name: seller.name,
      nickname: seller.nickname,
      bio: seller.bio,
      trustToken: seller.trustToken,
      totalSold: seller.products.length,
      avgRating:
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0,
      reviewCount: reviews.length,
    };
  }

  async update(id: string, userId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.sellerId !== userId) throw new ForbiddenException();
    if (product.status === 'SOLD') throw new BadRequestException('판매 완료된 상품은 수정할 수 없습니다');

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.description && { description: dto.description }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.tags && { tags: dto.tags }),
      },
    });
  }

  async remove(id: string, userId: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('상품을 찾을 수 없습니다');
    if (product.sellerId !== userId) throw new ForbiddenException();
    if (product.status === 'SOLD') throw new BadRequestException('판매 완료된 상품은 삭제할 수 없습니다');

    return this.prisma.product.update({ where: { id }, data: { isVisible: false } });
  }

  private async addPointBonus(userId: string, amount: number, memo: string) {
    const latest = await this.prisma.pointLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const balance = (latest?.balance || 0) + amount;
    await this.prisma.pointLog.create({
      data: { userId, type: 'EARN_BONUS', category: 'ACTIVITY', amount, balance, memo },
    });
  }

  async checkMilestoneBonuses(sellerId: string) {
    const soldCount = await this.prisma.product.count({
      where: { sellerId, status: 'SOLD' },
    });

    if (soldCount === 10) {
      await this.addPointBonus(sellerId, 1000, '누적 10건 판매 달성 보너스');
    } else if (soldCount === 50) {
      await this.addPointBonus(sellerId, 5000, '누적 50건 판매 달성 보너스');
    }
  }
}

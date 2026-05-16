import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto, SortOrder } from './dto/query-product.dto';
import { FileType, Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

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
    const { search, fileType, sort, page, limit } = query;
    const skip = ((page || 1) - 1) * (limit || 20);

    const where: Prisma.ProductWhereInput = {
      isVisible: true,
      status: 'ON_SALE',
      ...(fileType && { fileType }),
      ...(search && { title: { contains: search } }),
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

    return {
      items: items.map((p) => ({
        ...p,
        avgRating:
          p.reviews.length > 0
            ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
            : 0,
        reviewCount: p._count.reviews,
        reviews: undefined,
        _count: undefined,
      })),
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

    return { ...product, avgRating, reviewCount: product._count.reviews, _count: undefined };
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
      data: { userId, type: 'EARN_BONUS', amount, balance, memo },
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

import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isVisible) throw new NotFoundException('상품을 찾을 수 없습니다');

    const existing = await this.prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) throw new ConflictException('이미 찜한 상품입니다');

    return this.prisma.wishlist.create({ data: { userId, productId } });
  }

  async remove(userId: string, productId: string) {
    const item = await this.prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!item) throw new NotFoundException('찜 목록에 없는 상품입니다');

    return this.prisma.wishlist.delete({
      where: { userId_productId: { userId, productId } },
    });
  }

  async findAll(userId: string) {
    return this.prisma.wishlist.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            priceEth: true,
            imageKey: true,
            fileType: true,
            status: true,
            viewCount: true,
            seller: { select: { username: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

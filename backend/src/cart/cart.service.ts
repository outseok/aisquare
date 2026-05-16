import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isVisible || product.status !== 'ON_SALE') {
      throw new NotFoundException('구매 가능한 상품이 아닙니다');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) throw new ConflictException('이미 장바구니에 담긴 상품입니다');

    return this.prisma.cartItem.create({ data: { userId, productId } });
  }

  async remove(userId: string, productId: string) {
    const item = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!item) throw new NotFoundException('장바구니에 없는 상품입니다');

    return this.prisma.cartItem.delete({
      where: { userId_productId: { userId, productId } },
    });
  }

  async findAll(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            title: true,
            price: true,
            imageKey: true,
            fileType: true,
            status: true,
            seller: { select: { username: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async clear(userId: string) {
    return this.prisma.cartItem.deleteMany({ where: { userId } });
  }
}

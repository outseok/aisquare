import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async add(userId: string, productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isVisible || product.status !== 'ON_SALE') {
      throw new NotFoundException('구매 가능한 상품이 아닙니다');
    }
    if (product.sellerId === userId) throw new BadRequestException('본인이 등록한 상품은 장바구니에 담을 수 없습니다');

    // idempotent: 이미 담겨 있으면 그대로 반환 (사용자가 같은 상품 두 번 눌러도 에러 안 남)
    const existing = await this.prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) return { ...existing, alreadyExists: true };

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

import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: '내 장바구니 목록' })
  findAll(@Request() req) {
    return this.cartService.findAll(req.user.id);
  }

  @Post(':productId')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: '장바구니 담기 (PASS 인증 필요)' })
  add(@Request() req, @Param('productId') productId: string) {
    return this.cartService.add(req.user.id, productId);
  }

  @Delete('all')
  @ApiOperation({ summary: '장바구니 전체 비우기' })
  clear(@Request() req) {
    return this.cartService.clear(req.user.id);
  }

  @Delete(':productId')
  @ApiOperation({ summary: '장바구니 개별 제거' })
  remove(@Request() req, @Param('productId') productId: string) {
    return this.cartService.remove(req.user.id, productId);
  }
}

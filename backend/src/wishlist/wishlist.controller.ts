import { Controller, Get, Post, Delete, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: '내 찜 목록' })
  findAll(@Request() req) {
    return this.wishlistService.findAll(req.user.id);
  }

  @Post(':productId')
  @ApiOperation({ summary: '찜 추가' })
  add(@Request() req, @Param('productId') productId: string) {
    return this.wishlistService.add(req.user.id, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: '찜 제거' })
  remove(@Request() req, @Param('productId') productId: string) {
    return this.wishlistService.remove(req.user.id, productId);
  }
}

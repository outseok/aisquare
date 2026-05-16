import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmTossPaymentDto } from './dto/confirm-toss-payment.dto';
import { ConfirmSquarePaymentDto } from './dto/confirm-square-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: '상품 구매 (PASS 인증 필요)' })
  create(@Request() req, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, dto);
  }

  @Get('my/purchases')
  @ApiOperation({ summary: '내 구매 내역' })
  getBuyHistory(@Request() req) {
    return this.ordersService.getBuyHistory(req.user.id);
  }

  @Get('my/sales')
  @ApiOperation({ summary: '내 판매 내역' })
  getSellHistory(@Request() req) {
    return this.ordersService.getSellHistory(req.user.id);
  }

  @Post(':id/pay/toss')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'Toss 결제 승인 (결제창 완료 후 호출)' })
  confirmTossPayment(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ConfirmTossPaymentDto,
  ) {
    return this.ordersService.confirmTossPayment(id, req.user.id, dto);
  }

  @Post(':id/pay/square')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'Square 결제 확정 (BE2 txHash 전달)' })
  confirmSquarePayment(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ConfirmSquarePaymentDto,
  ) {
    return this.ordersService.confirmSquarePayment(id, req.user.id, dto);
  }

  @Patch(':id/confirm')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: '구매 확정 (구매자 직접)' })
  confirm(@Param('id') id: string, @Request() req) {
    return this.ordersService.confirm(id, req.user.id);
  }

  @Get(':id/download')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: '파일 다운로드 URL 발급' })
  getDownloadUrl(@Param('id') id: string, @Request() req) {
    return this.ordersService.getDownloadUrl(id, req.user.id);
  }
}

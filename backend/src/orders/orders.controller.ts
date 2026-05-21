import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
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
  @ApiOperation({ summary: '파일 다운로드 URL 발급 (JSON 응답)' })
  getDownloadUrl(@Param('id') id: string, @Request() req) {
    return this.ordersService.getDownloadUrl(id, req.user.id);
  }

  // 모든 확장자 다운로드를 위해 BE가 직접 스트리밍 — CloudFront cross-origin download 우회
  // 주의: PassVerifiedGuard 안 씀 (이미 구매 완료한 주문이므로 재차 PASS 강제하지 않음)
  @Get(':id/download/file')
  @ApiOperation({ summary: '실제 파일 바이너리 스트리밍 (모든 확장자 다운로드)' })
  async downloadFile(@Param('id') id: string, @Request() req, @Res() res: Response) {
    try {
      const { buf, contentType, filename } = await this.ordersService.streamDownload(id, req.user.id);
      const encoded = encodeURIComponent(filename);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Content-Disposition', `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(buf);
    } catch (err: any) {
      console.error(`[DOWNLOAD] order=${id} user=${req.user?.id} err=${err?.message}`);
      const status = err?.status || 500;
      res.status(status).json({ message: err?.message || 'download failed', orderId: id });
    }
  }
}

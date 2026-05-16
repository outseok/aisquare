import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';
import { ChargeRpDto } from './dto/charge-rp.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
import { RequestProductPayDto } from './dto/request-product-pay.dto';
import { ConfirmProductPayDto } from './dto/confirm-product-pay.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get('toss/config')
  @ApiOperation({ summary: '토스 결제 클라이언트 키 조회 (프론트엔드용)' })
  getTossConfig() {
    return this.paymentsService.getTossClientKey();
  }

  // ── RP 충전 ────────────────────────────────────────────────────────────────

  @Post('toss/charge/request')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PassVerifiedGuard)
  @ApiOperation({ summary: 'RP 충전 결제 요청 (토스 결제창 파라미터 발급)' })
  requestRpCharge(@Request() req, @Body() dto: ChargeRpDto) {
    return this.paymentsService.requestRpCharge(req.user.id, dto);
  }

  @Post('toss/charge/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PassVerifiedGuard)
  @ApiOperation({ summary: 'RP 충전 결제 승인 (토스 콜백 후 호출)' })
  confirmRpCharge(@Request() req, @Body() dto: ConfirmChargeDto) {
    return this.paymentsService.confirmRpCharge(req.user.id, dto);
  }

  // ── 상품 구매 (원화 결제) ──────────────────────────────────────────────────

  @Post('toss/product/request')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PassVerifiedGuard)
  @ApiOperation({ summary: '상품 원화 결제 요청 (토스 결제창 파라미터 발급)' })
  requestProductPay(@Request() req, @Body() dto: RequestProductPayDto) {
    return this.paymentsService.requestProductPay(req.user.id, dto);
  }

  @Post('toss/product/confirm')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PassVerifiedGuard)
  @ApiOperation({ summary: '상품 원화 결제 승인 및 주문 생성 (토스 콜백 후 호출)' })
  confirmProductPay(@Request() req, @Body() dto: ConfirmProductPayDto) {
    return this.paymentsService.confirmProductPay(req.user.id, dto);
  }
}

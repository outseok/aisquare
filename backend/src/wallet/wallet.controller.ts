import {
  Controller, Get, Post, Body, Param, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';
import { WalletService } from './wallet.service';
import {
  RequestSquareChargeDto,
  ConfirmSquareChargeDto,
} from './dto/charge-square.dto';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PassVerifiedGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  // ── Square Wallet ──────────────────────────────────────────────────────────

  @Get('square/balance')
  @ApiOperation({ summary: 'Square Wallet 잔액 조회' })
  getSquareBalance(@Request() req: any) {
    return this.walletService.getSquareBalance(req.user.id);
  }

  @Get('square/history')
  @ApiOperation({ summary: 'Square Wallet 거래 내역 (최신 50건)' })
  getSquareHistory(@Request() req: any) {
    return this.walletService.getSquareHistory(req.user.id);
  }

  @Post('square/charge')
  @ApiOperation({
    summary: 'Square Wallet 충전 요청',
    description: 'Toss Payments 결제창 파라미터를 반환합니다. FE에서 Toss SDK로 결제창을 호출하세요.',
  })
  requestSquareCharge(@Request() req: any, @Body() dto: RequestSquareChargeDto) {
    return this.walletService.requestSquareCharge(req.user.id, dto);
  }

  @Post('square/charge/confirm')
  @ApiOperation({
    summary: 'Square Wallet 충전 확인',
    description: 'Toss 결제 완료 후 Square Wallet에 금액을 적립합니다.',
  })
  confirmSquareCharge(@Request() req: any, @Body() dto: ConfirmSquareChargeDto) {
    return this.walletService.confirmSquareCharge(req.user.id, dto);
  }

  // ── Point Wallet ───────────────────────────────────────────────────────────

  @Get('point/balance')
  @ApiOperation({ summary: 'Point Wallet 잔액 조회' })
  getPointBalance(@Request() req: any) {
    return this.walletService.getPointBalance(req.user.id);
  }

  @Get('point/history')
  @ApiOperation({ summary: 'Point Wallet 거래 내역 (최신 50건)' })
  getPointHistory(@Request() req: any) {
    return this.walletService.getPointHistory(req.user.id);
  }

  // ── 에스크로 조회 ──────────────────────────────────────────────────────────

  @Get('escrow/:orderId')
  @ApiOperation({
    summary: '에스크로(Admin Wallet) 상태 조회',
    description: '구매자 또는 판매자만 조회 가능. Fabric 원장 상태 포함.',
  })
  getEscrowState(@Param('orderId') orderId: string, @Request() req: any) {
    return this.walletService.getEscrowState(orderId, req.user.id);
  }
}

import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { PrepareChargeDto } from './dto/prepare-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
import { InstantChargeDto } from './dto/instant-charge.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Post('charge')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'Square 충전 준비 (Toss 결제창 열기 전)' })
  prepareCharge(@Request() req, @Body() dto: PrepareChargeDto) {
    return this.walletService.prepareCharge(req.user.id, dto);
  }

  @Post('square/charge')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'Square 즉시 충전 (YR 호환 데모 — Toss 검증 없이 바로 적립)' })
  instantCharge(@Request() req, @Body() dto: InstantChargeDto) {
    return this.walletService.instantCharge(req.user.id, dto);
  }

  @Post('charge/:id/confirm')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'Square 충전 확정 (Toss 결제 완료 후)' })
  confirmCharge(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: ConfirmChargeDto,
  ) {
    return this.walletService.confirmCharge(id, req.user.id, dto);
  }

  @Get('charges')
  @ApiOperation({ summary: 'Square 충전 내역 (walletCharge 레코드)' })
  getChargeHistory(@Request() req) {
    return this.walletService.getChargeHistory(req.user.id);
  }

  @Post('withdraw')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'Square 출금/환불 — 등록된 계좌로 송금 (Fabric 차감)' })
  withdraw(@Request() req, @Body() dto: WithdrawDto) {
    return this.walletService.withdraw(req.user.id, dto.squareAmount);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Square Wallet 잔액 (Fabric)' })
  getBalance(@Request() req) {
    return this.walletService.getSquareBalance(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Square Wallet 거래 내역 (Fabric)' })
  getHistory(@Request() req) {
    return this.walletService.getSquareHistory(req.user.id);
  }

  @Get('toss-client-key')
  @ApiOperation({ summary: 'Toss 클라이언트 키 (프론트엔드용)' })
  getTossClientKey() {
    return { clientKey: process.env.TOSS_CLIENT_KEY };
  }
}

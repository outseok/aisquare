import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { PrepareChargeDto } from './dto/prepare-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
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
  @ApiOperation({ summary: 'Square 충전 내역' })
  getChargeHistory(@Request() req) {
    return this.walletService.getChargeHistory(req.user.id);
  }
}

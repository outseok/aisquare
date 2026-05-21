import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';
import { WithdrawDto } from './dto/withdraw.dto';

@ApiTags('points')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('points')
export class PointsController {
  constructor(private pointsService: PointsService) {}

  @Get('balance')
  @ApiOperation({ summary: '내 RP 잔액 조회' })
  getBalance(@Request() req) {
    return this.pointsService.getBalance(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: '내 RP 내역 조회 (페이지네이션)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pointsService.getHistory(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Post('withdraw')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'RP 출금 (5,000 RP 이상, 100 RP 단위)' })
  withdraw(@Request() req, @Body() dto: WithdrawDto) {
    return this.pointsService.withdraw(req.user.id, dto);
  }

  @Get('trust-token')
  @ApiOperation({ summary: '내 신뢰 토큰 조회' })
  getTrustToken(@Request() req) {
    return this.pointsService.getUserTrustToken(req.user.id);
  }

  // ── PAID / ACTIVITY 분리 잔액 ───────────────────────────
  @Get('balance/paid')
  @ApiOperation({ summary: '결제 포인트 (PAID) 잔액 — 네이버 전환 가능' })
  getPaidBalance(@Request() req) {
    return this.pointsService.getPaidBalance(req.user.id);
  }

  @Get('balance/activity')
  @ApiOperation({ summary: '활동 포인트 (ACTIVITY) 잔액 — 전환 불가, 사이트 내 사용만' })
  getActivityBalance(@Request() req) {
    return this.pointsService.getActivityBalance(req.user.id);
  }

  // ── 네이버페이 전환 ─────────────────────────────────────
  @Post('exchange-naver')
  @UseGuards(PassVerifiedGuard)
  @ApiOperation({ summary: 'PAID 포인트를 네이버페이 포인트로 전환 (PASS 필요)' })
  exchangeToNaver(@Request() req, @Body() body: { amount: number }) {
    return this.pointsService.exchangeToNaver(req.user.id, body.amount);
  }

  @Get('exchange-naver')
  @ApiOperation({ summary: '내 네이버 전환 내역' })
  myExchanges(@Request() req) {
    return this.pointsService.getMyExchanges(req.user.id);
  }
}

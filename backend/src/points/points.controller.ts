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
}

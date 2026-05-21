import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NaverAdminService } from './naver-admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NaverAdminGuard } from '../auth/naver-admin.guard';

@ApiTags('naver-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, NaverAdminGuard)
@Controller('naver-admin')
export class NaverAdminController {
  constructor(private service: NaverAdminService) {}

  @Get('exchanges')
  @ApiOperation({ summary: '[네이버 어드민] 전환 요청 목록' })
  list(@Query('status') status?: string) {
    return this.service.listExchanges(status);
  }

  @Get('summary')
  @ApiOperation({ summary: '[네이버 어드민] PENDING/CONFIRMED/REJECTED 카운트' })
  summary() {
    return this.service.getSummary();
  }

  @Post('exchanges/:id/confirm')
  @ApiOperation({ summary: '[네이버 어드민] 전환 승인 (NaverPayMSP 서명)' })
  confirm(
    @Param('id') id: string,
    @Body() body: { naverTxId?: string },
    @Request() req,
  ) {
    return this.service.confirm(id, body?.naverTxId, req.user.id);
  }

  @Post('exchanges/:id/reject')
  @ApiOperation({ summary: '[네이버 어드민] 전환 거부 (NaverPayMSP 서명, PAID 환불)' })
  reject(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req,
  ) {
    return this.service.reject(id, body?.reason || '', req.user.id);
  }
}

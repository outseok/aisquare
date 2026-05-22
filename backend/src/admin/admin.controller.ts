import {
  Controller, Get, Patch, Param, Query, Body, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ReportStatus } from '../common/prisma-enums';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('reports')
  @ApiOperation({ summary: '[관리자] 신고 목록 조회' })
  getReports(@Query('status') status?: ReportStatus) {
    return this.adminService.getReports(status);
  }

  @Get('reports/:id')
  @ApiOperation({ summary: '[관리자] 신고 상세 조회' })
  getReportDetail(@Param('id') id: string) {
    return this.adminService.getReportDetail(id);
  }

  @Patch('reports/:id/process')
  @ApiOperation({ summary: '[관리자] 신고 처리 (REFUNDED or APPROVED)' })
  processReport(
    @Param('id') id: string,
    @Body() body: { action: 'REFUNDED' | 'APPROVED' },
    @Request() req,
  ) {
    return this.adminService.processReport(id, body.action, req.user.id);
  }

  @Patch('products/:id/visibility')
  @ApiOperation({ summary: '[관리자] 상품 노출 상태 변경' })
  toggleVisibility(
    @Param('id') id: string,
    @Body() body: { isVisible: boolean },
    @Request() req,
  ) {
    return this.adminService.toggleProductVisibility(id, body.isVisible, req.user.id);
  }

  @Get('settlement/stats')
  @ApiOperation({ summary: '[관리자] 정산 현황 통계' })
  getSettlementStats() {
    return this.adminService.getSettlementStats();
  }

  @Get('unread-count')
  @ApiOperation({ summary: '[관리자] 미처리 신고·전환 카운트 (헤더 뱃지용)' })
  getUnreadCount() {
    return this.adminService.getUnreadCount();
  }

  @Get('products')
  @ApiOperation({ summary: '[관리자] 전체 상품 목록' })
  getAllProducts(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAllProducts(Number(page) || 1, Number(limit) || 20);
  }

  @Get('logs')
  @ApiOperation({ summary: '[관리자] 관리자 액션 로그' })
  getAdminLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAdminLogs(Number(page) || 1, Number(limit) || 50);
  }

  // ── 사용자 관리 ─────────────────────────────────────────
  @Get('users')
  @ApiOperation({ summary: '[관리자] 사용자 목록' })
  getUsers(@Query('q') q?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getUsers(q, Number(page) || 1, Number(limit) || 50);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: '[관리자] 사용자 상태 변경 (ACTIVE / SUSPENDED / DELETED)' })
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'DELETED' },
    @Request() req,
  ) {
    return this.adminService.updateUserStatus(id, body.status, req.user.id);
  }

  @Patch('users/:id/trust-token')
  @ApiOperation({ summary: '[관리자] 신뢰토큰 수동 조정 (0-100)' })
  adjustTrustToken(
    @Param('id') id: string,
    @Body() body: { value: number; reason?: string },
    @Request() req,
  ) {
    return this.adminService.adjustTrustToken(id, body.value, body.reason || '관리자 조정', req.user.id);
  }

  // ── NaverPay 전환 처리 ─────────────────────────────────
  @Get('naver-exchanges')
  @ApiOperation({ summary: '[관리자] NaverPay 전환 목록' })
  getNaverExchanges(@Query('status') status?: string) {
    return this.adminService.getNaverExchanges(status);
  }

  @Patch('naver-exchanges/:id/process')
  @ApiOperation({ summary: '[관리자] NaverPay 전환 처리 (CONFIRMED / REJECTED)' })
  processNaverExchange(
    @Param('id') id: string,
    @Body() body: { action: 'CONFIRMED' | 'REJECTED'; naverTxId?: string; reason?: string },
    @Request() req,
  ) {
    return this.adminService.processNaverExchange(id, body, req.user.id);
  }

  // ── 강제 환불 (Escrow 수동 unlock) ─────────────────────
  @Patch('orders/:id/force-refund')
  @ApiOperation({ summary: '[관리자] 주문 강제 환불 (관리자 권한)' })
  forceRefund(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.adminService.forceRefund(id, body.reason, req.user.id);
  }
}

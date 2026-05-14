import {
  Controller, Get, Patch, Param, Query, Body, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ReportStatus } from '@prisma/client';

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
}

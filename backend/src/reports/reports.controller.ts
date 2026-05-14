import {
  Controller, Post, Get, Param, Body, UseGuards, Request,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PassVerifiedGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Post('order/:orderId')
  @ApiOperation({ summary: '신고 접수 (구매자 전용, PASS 인증 필요)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 5))
  create(
    @Request() req,
    @Param('orderId') orderId: string,
    @Body() dto: CreateReportDto,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    return this.reportsService.create(req.user.id, orderId, dto, images || []);
  }

  @Get(':id')
  @ApiOperation({ summary: '신고 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }
}

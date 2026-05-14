import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString } from 'class-validator';

class PresignedUploadDto {
  @IsString() filename: string;
  @IsString() contentType: string;
}

@ApiTags('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private filesService: FilesService) {}

  @Post('presigned-upload')
  @ApiOperation({ summary: 'S3 presigned 업로드 URL 발급' })
  getPresignedUploadUrl(@Body() dto: PresignedUploadDto) {
    return this.filesService.getPresignedUploadUrl(dto.filename, dto.contentType);
  }

  @Post('check-url')
  @ApiOperation({ summary: 'URL 안전성 검사 (Google Safe Browsing)' })
  checkUrl(@Body() body: { url: string }) {
    return this.filesService.checkUrlSafety(body.url);
  }
}

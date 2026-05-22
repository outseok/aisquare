import 'multer';
import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseGuards, Request, UseInterceptors, UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';
import { FilesService } from '../files/files.service';
import { FileType } from '../common/prisma-enums';

const FILE_TYPE_MAP: Record<string, FileType> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'video/mp4': 'MP4',
  'text/plain': 'TXT',
  'application/zip': 'ZIP',
  'application/x-zip-compressed': 'ZIP',
};

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private filesService: FilesService,
  ) {}

  @Get()
  @ApiOperation({ summary: '상품 목록 조회 (비회원 가능)' })
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('sellers/ranking')
  @ApiOperation({ summary: '판매자 랭킹 (별점·판매수·신뢰토큰 기준)' })
  getSellersRanking(@Query('limit') limit?: string) {
    return this.productsService.getSellersRanking(limit ? Number(limit) : 50);
  }

  @Get(':id')
  @ApiOperation({ summary: '상품 상세 조회 (비회원 가능)' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get('seller/:username/stats')
  @ApiOperation({ summary: '판매자 통계 (누적 판매수, 평점)' })
  getSellerStats(@Param('username') username: string) {
    return this.productsService.getSellerStats(username);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PassVerifiedGuard)
  @Post()
  @ApiOperation({ summary: '상품 등록 (PASS 인증 필요)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'image', maxCount: 1 },
    ]),
  )
  async create(
    @Request() req,
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: { file?: Express.Multer.File[]; image?: Express.Multer.File[] },
  ) {
    const sellFile = files.file?.[0];
    if (!sellFile) throw new BadRequestException('판매 파일은 필수입니다');

    const fileType = FILE_TYPE_MAP[sellFile.mimetype];
    if (!fileType) throw new BadRequestException('지원하지 않는 파일 형식입니다');

    const fileKey = await this.filesService.uploadFile(sellFile);
    let imageKey: string | undefined;
    if (files.image?.[0]) {
      imageKey = await this.filesService.uploadFile(files.image[0]);
    }

    return this.productsService.create(req.user.id, dto, fileKey, fileType, imageKey);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({ summary: '상품 수정 (본인 상품만, 판매 완료 전)' })
  update(@Param('id') id: string, @Request() req, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, req.user.id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: '상품 삭제 (본인 상품만)' })
  remove(@Param('id') id: string, @Request() req) {
    return this.productsService.remove(id, req.user.id);
  }
}

import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileType } from '../../common/prisma-enums';

export enum SortOrder {
  LATEST = 'latest',
  REVIEWS = 'reviews',
  RATING = 'rating',
}

export class QueryProductDto {
  @ApiPropertyOptional({ description: '제목/태그 검색' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: FileType })
  @IsOptional()
  @IsEnum(FileType)
  fileType?: FileType;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.LATEST })
  @IsOptional()
  @IsEnum(SortOrder)
  sort?: SortOrder = SortOrder.LATEST;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'SOLD 상품도 포함 (판매자 페이지 전용)' })
  @IsOptional()
  @IsString()
  includeSold?: string;

  @ApiPropertyOptional({ description: '특정 판매자(username)의 상품만' })
  @IsOptional()
  @IsString()
  sellerUsername?: string;
}

import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FileType } from '@prisma/client';

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
}

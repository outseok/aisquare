import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'GPT-4 프롬프트 완전 정복 가이드 v2' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '업데이트된 설명입니다...' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0.005, description: 'ETH 단위 가격' })
  @IsOptional()
  @Transform(({ value }) => value !== undefined ? parseFloat(value) : undefined)
  @IsNumber()
  @Min(0)
  priceEth?: number;

  @ApiPropertyOptional({ type: [String], example: ['GPT', 'AI'] })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch { return [value]; }
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

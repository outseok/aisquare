import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';
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
  @IsNumber()
  @Min(0)
  priceEth?: number;

  @ApiPropertyOptional({ type: [String], example: ['GPT', 'AI'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

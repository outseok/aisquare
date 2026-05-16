import { IsString, IsNumber, IsOptional, IsArray, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'GPT-4 프롬프트 완전 정복 가이드' })
  @IsString()
  title: string;

  @ApiProperty({ example: '이 가이드를 통해 GPT-4를 200% 활용하세요...' })
  @IsString()
  description: string;

  @ApiProperty({ example: 0.01, description: 'ETH 단위 가격' })
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  @Min(0)
  priceEth: number;

  @ApiPropertyOptional({ type: [String], example: ['GPT', 'AI', '프롬프트'] })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch { return [value]; }
  })
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

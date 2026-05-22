import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestProductPayDto {
  @ApiProperty({ description: '구매할 상품 ID' })
  @IsString()
  productId: string;

  @ApiPropertyOptional({ description: '사용할 Point (1 Point = 1원 할인)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  usedPoint?: number;
}

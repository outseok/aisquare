import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: 'cuid-product-id' })
  @IsString()
  productId: string;

  @ApiProperty({
    enum: ['RP', 'SQUARE'],
    description: 'RP = 레거시 포인트 결제 | SQUARE = Square Wallet 결제 | TOSS는 /payments/toss/product 사용',
  })
  @IsEnum(['RP', 'SQUARE'])
  paymentMethod: PayMethod;

  @ApiPropertyOptional({
    description: 'Point Wallet 복합 결제 시 차감할 포인트 (할인 금액)',
    example: 500,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  usedPoint?: number;
}

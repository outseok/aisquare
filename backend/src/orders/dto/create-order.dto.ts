import { IsString, IsEnum, IsOptional, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PayMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: 'cuid-product-id' })
  @IsString()
  productId: string;

  @ApiProperty({ enum: PayMethod })
  @IsEnum(PayMethod)
  paymentMethod: PayMethod;

  @ApiPropertyOptional({ example: 0, description: '사용할 Point (0 이상, Point Wallet 잔액 이내)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  usedPoint?: number;
}

import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PayMethod } from '@prisma/client';

export class CreateOrderDto {
  @ApiProperty({ example: 'cuid-product-id' })
  @IsString()
  productId: string;

  @ApiProperty({ enum: PayMethod })
  @IsEnum(PayMethod)
  paymentMethod: PayMethod;
}

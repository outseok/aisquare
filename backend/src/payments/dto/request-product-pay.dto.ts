import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestProductPayDto {
  @ApiProperty({ description: '구매할 상품 ID' })
  @IsString()
  productId: string;
}

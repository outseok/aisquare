import { IsInt, IsPositive, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestSquareChargeDto {
  @ApiProperty({ description: '충전할 Square 금액 (원화 KRW)', example: 10000 })
  @IsInt()
  @IsPositive()
  amount: number;
}

export class ConfirmSquareChargeDto {
  @ApiProperty({ description: 'Toss 결제 키', example: 'toss_payment_key_xxx' })
  @IsString()
  paymentKey: string;

  @ApiProperty({ description: 'Toss 주문 ID', example: 'sq-uuid-xxx' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '결제 금액 (KRW)', example: 10000 })
  @IsInt()
  @IsPositive()
  amount: number;
}

export class UsePointDto {
  @ApiProperty({ description: '사용할 포인트 (KRW 단위)', example: 500 })
  @IsInt()
  @IsPositive()
  amount: number;

  @ApiPropertyOptional({ description: '사용 메모', example: '상품 구매 할인' })
  @IsOptional()
  @IsString()
  memo?: string;
}

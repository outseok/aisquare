import { IsString, IsInt, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmProductPayDto {
  @ApiProperty({ description: '토스 결제키' })
  @IsString()
  paymentKey: string;

  @ApiProperty({ description: '토스 주문ID (백엔드 발급)' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '결제 금액 (원화)' })
  @IsInt()
  @IsPositive()
  amount: number;
}

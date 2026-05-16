import { IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmTossPaymentDto {
  @ApiProperty({ example: 'toss_paymentKey_xxx', description: 'Toss 결제 키' })
  @IsString()
  paymentKey: string;

  @ApiProperty({ example: 5000, description: '결제 금액 (KRW)' })
  @IsNumber()
  @Min(0)
  amount: number;
}

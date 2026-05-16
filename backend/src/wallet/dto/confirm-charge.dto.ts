import { IsString, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmChargeDto {
  @ApiProperty({ description: 'Toss 결제 키' })
  @IsString()
  paymentKey: string;

  @ApiProperty({ example: 10000, description: '결제 금액 (KRW)' })
  @IsInt()
  @Min(1)
  amount: number;
}

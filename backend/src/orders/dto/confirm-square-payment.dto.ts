import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmSquarePaymentDto {
  @ApiProperty({ description: 'BE2 Square 결제 트랜잭션 해시' })
  @IsString()
  txHash: string;
}

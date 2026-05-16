import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PrepareChargeDto {
  @ApiProperty({ example: 10000, description: '충전할 금액 (KRW 원)' })
  @IsInt()
  @Min(1000)
  amountKrw: number;
}

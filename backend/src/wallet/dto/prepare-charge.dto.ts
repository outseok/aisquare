import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PrepareChargeDto {
  @ApiProperty({ example: 5500, description: '충전할 금액 (KRW 원, 최소 5,500원, 1,100원 단위)' })
  @IsInt()
  @Min(5500)
  amountKrw: number;
}

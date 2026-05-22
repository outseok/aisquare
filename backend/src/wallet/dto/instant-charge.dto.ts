import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InstantChargeDto {
  @ApiProperty({ example: 10000, description: '충전할 Square 수량 (최소 5,000, 1,000 단위)' })
  @IsInt()
  @Min(5000)
  squareAmount: number;
}

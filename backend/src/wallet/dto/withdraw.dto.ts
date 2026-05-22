import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ example: 10000, description: '출금할 Square 수량 (최소 5,000)' })
  @IsInt()
  @Min(5000)
  squareAmount: number;
}

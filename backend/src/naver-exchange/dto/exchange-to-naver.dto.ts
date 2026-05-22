import { IsInt, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeToNaverDto {
  @ApiProperty({
    description: '네이버페이로 전환할 유료 포인트 수량 (최소 100P)',
    example: 1000,
  })
  @IsInt()
  @IsPositive()
  @Min(100)
  amount: number;
}

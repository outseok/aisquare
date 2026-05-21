import { IsInt, IsPositive, Min, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExchangeFromNaverDto {
  @ApiProperty({
    description: '전환할 네이버페이 포인트 수량 (최소 100P)',
    example: 1000,
  })
  @IsInt()
  @IsPositive()
  @Min(100)
  amount: number;

  @ApiProperty({
    description: '네이버페이 포인트 차감 트랜잭션 ID (데모: 임의 문자열)',
    example: 'naver-tx-demo-001',
  })
  @IsString()
  naverTxId: string;
}

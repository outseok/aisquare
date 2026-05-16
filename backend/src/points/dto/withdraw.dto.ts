import { IsInt, Min, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

@ValidatorConstraint({ name: 'divisibleBy100' })
class DivisibleBy100 implements ValidatorConstraintInterface {
  validate(value: number) { return Number.isInteger(value) && value % 100 === 0; }
  defaultMessage() { return '100 RP 단위로 입력해야 합니다'; }
}

export class WithdrawDto {
  @ApiProperty({ description: '출금할 RP 수량 (100 RP 단위, 최소 500 RP)', example: 500 })
  @IsInt()
  @Min(500, { message: '최소 500 RP부터 출금 가능합니다' })
  @Validate(DivisibleBy100)
  amount: number;
}

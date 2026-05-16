import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPhoneDto {
  @ApiProperty({ description: '포트원 본인인증 imp_uid' })
  @IsString()
  impUid: string;
}

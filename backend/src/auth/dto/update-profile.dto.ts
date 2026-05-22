import { IsEmail, IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '새닉네임', description: '닉네임 (2~20자, unique)' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  nickname?: string;

  @ApiPropertyOptional({ example: 'new@example.com', description: '이메일 (unique)' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '국민은행', description: '정산 계좌 은행명' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bankName?: string;

  @ApiPropertyOptional({ example: '123456-78-901234', description: '정산 계좌 번호 (숫자/하이픈)' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[0-9-]+$/, { message: '계좌번호는 숫자와 하이픈만 가능합니다' })
  accountNumber?: string;

  @ApiPropertyOptional({ example: '홍길동', description: '예금주 (실명)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  accountHolder?: string;
}

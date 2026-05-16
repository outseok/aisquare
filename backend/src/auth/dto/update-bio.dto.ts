import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBioDto {
  @ApiPropertyOptional({ example: '안녕하세요, AI 프롬프트를 전문으로 판매합니다.', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;
}

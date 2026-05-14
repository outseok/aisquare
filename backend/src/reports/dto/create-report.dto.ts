import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ example: '파일이 설명과 다릅니다' })
  @IsString()
  reason: string;
}

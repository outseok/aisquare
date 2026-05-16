import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'john123' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'Password1!' })
  @IsString()
  password: string;
}

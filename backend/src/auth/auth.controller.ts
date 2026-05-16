import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '회원가입' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: '로그인' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('verify-phone')
  @ApiOperation({ summary: '핸드폰 인증 완료 처리' })
  verifyPhone(@Request() req) {
    return this.authService.verifyPhone(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ summary: '내 프로필 조회' })
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/tokens')
  @ApiOperation({ summary: '신뢰 토큰 변동 내역' })
  getTokenHistory(@Request() req) {
    return this.authService.getTokenHistory(req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/points')
  @ApiOperation({ summary: '포인트 변동 내역' })
  getPointHistory(@Request() req) {
    return this.authService.getPointHistory(req.user.id);
  }
}

import { Controller, Post, Body, Get, UseGuards, Request, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('wallet-login')
  @ApiOperation({ summary: 'MetaMask 지갑 주소로 로그인/회원가입' })
  async walletLogin(@Body() body: { walletAddress: string }) {
    return this.authService.loginOrRegister(body.walletAddress);
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
  @Patch('pass-verify')
  @ApiOperation({ summary: 'PASS 본인인증 완료 처리 (백엔드 콜백)' })
  completePassVerify(@Request() req, @Body() body: { phoneNumber: string }) {
    return this.authService.completePassVerification(req.user.id, body.phoneNumber);
  }
}

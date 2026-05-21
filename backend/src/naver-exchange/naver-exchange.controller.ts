import {
  Controller, Post, Get, Body, Headers, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';
import { NaverExchangeService } from './naver-exchange.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PassVerifiedGuard } from '../auth/pass-verified.guard';
import { AdminGuard } from '../auth/admin.guard';
import { ExchangeToNaverDto } from './dto/exchange-to-naver.dto';
import { ExchangeFromNaverDto } from './dto/exchange-from-naver.dto';

class DemoFromNaverDto {
  @IsInt() @Min(1) amount: number;
  @IsString() naverTxId: string;
}

@ApiTags('naver-exchange')
@Controller('points/naver')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PassVerifiedGuard)
export class NaverExchangeController {
  constructor(private readonly service: NaverExchangeService) {}

  @Get('summary')
  @ApiOperation({ summary: '포인트 잔액 요약 조회 (PAID/ACTIVITY 분리)' })
  getSummary(@Request() req) {
    return this.service.getPointSummary(req.user.id);
  }

  @Post('to-naver')
  @ApiOperation({
    summary: 'AI Square 유료 포인트 → 네이버페이 포인트 전환',
    description:
      'PAID 포인트만 전환 가능. 최소 100P. ' +
      '데모 모드(NAVERPAY_ENABLED=false)에서는 NAVERPAY_DEMO_KEY로 자동 승인됩니다.',
  })
  exchangeToNaver(@Request() req, @Body() dto: ExchangeToNaverDto) {
    return this.service.exchangeToNaver(req.user.id, dto);
  }

  @Post('from-naver')
  @ApiOperation({
    summary: '네이버페이 포인트 → AI Square 유료 포인트 전환 (실제 연동용)',
    description: '실제 NaverPay가 naverTxId를 전달하는 경로. 데모에서는 /demo/from-naver 를 사용하세요.',
  })
  exchangeFromNaver(@Request() req, @Body() dto: ExchangeFromNaverDto) {
    return this.service.exchangeFromNaver(req.user.id, dto);
  }

  /**
   * 데모 전용 — 가상 NaverPay 키를 헤더로 전달해 FROM_NAVER 전환 시뮬레이션.
   * 헤더: X-NaverPay-Demo-Key: <NAVERPAY_DEMO_KEY 환경변수 값>
   */
  @Post('demo/from-naver')
  @ApiOperation({
    summary: '[데모] 가상 키로 네이버페이 → AI Square 전환 시뮬레이션',
    description:
      '실제 NaverPay 없이 PAID 포인트 입금을 시연합니다.\n\n' +
      '헤더 `X-NaverPay-Demo-Key` 에 .env 의 `NAVERPAY_DEMO_KEY` 값을 넣으세요.\n\n' +
      '`naverTxId` 는 임의 문자열로도 가능합니다 (중복 방지만 체크).',
  })
  @ApiHeader({ name: 'X-NaverPay-Demo-Key', description: '가상 NaverPay 키 (NAVERPAY_DEMO_KEY)', required: true })
  demoFromNaver(
    @Headers('x-naverpay-demo-key') demoKey: string,
    @Request() req,
    @Body() dto: DemoFromNaverDto,
  ) {
    return this.service.demoFromNaver(demoKey, req.user.id, dto.amount, dto.naverTxId);
  }

  @Get('history')
  @ApiOperation({ summary: '포인트 교환 내역 조회' })
  getHistory(@Request() req) {
    return this.service.getExchangeHistory(req.user.id);
  }
}

// ── 관리자 전용: 체인코드에 가상 키 등록 ─────────────────────────────────────

@ApiTags('admin')
@Controller('admin/fabric')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
export class NaverExchangeAdminController {
  constructor(private readonly service: NaverExchangeService) {}

  @Post('demo/naver-key')
  @ApiOperation({
    summary: '[관리자] 체인코드에 가상 NaverPay 키 등록',
    description:
      'Fabric이 활성화된 환경에서 .env 의 NAVERPAY_DEMO_KEY 값을 ' +
      'naver-channel exchange 체인코드 상태에 등록합니다.\n\n' +
      '이 키가 등록돼야 DemoConfirmExchange / RecordFromNaver 체인코드 함수가 동작합니다.',
  })
  initDemoKey() {
    return this.service.initChaincodeDemoKey();
  }
}

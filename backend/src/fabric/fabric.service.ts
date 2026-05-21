import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Hyperledger Fabric Gateway 연동 서비스
 *
 * FABRIC_ENABLED=true  → @hyperledger/fabric-gateway SDK로 실제 체인코드 호출
 * FABRIC_ENABLED=false → 데모 모드 (로그 출력 + 의미 있는 더미 데이터 반환)
 *
 * 체인코드:
 *   wallet  : Square Wallet / Point Wallet / Admin Wallet(에스크로) / 거래 원장
 *
 * 설치 필요 패키지 (FABRIC_ENABLED=true 시):
 *   npm install @hyperledger/fabric-gateway @grpc/grpc-js
 */
@Injectable()
export class FabricService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FabricService.name);
  readonly useFabric = process.env.FABRIC_ENABLED === 'true';

  private gateway: any = null;
  private grpcClient: any = null;

  async onModuleInit() {
    if (this.useFabric) {
      try {
        await this.connect();
        this.logger.log('Fabric Gateway 연결 성공');
      } catch (e: any) {
        this.logger.error(`Fabric Gateway 연결 실패: ${e.message}`);
        this.logger.warn(
          '@hyperledger/fabric-gateway, @grpc/grpc-js 패키지가 설치되어 있는지 확인하세요.',
        );
      }
    } else {
      this.logger.log('Fabric 데모 모드 활성화 (FABRIC_ENABLED=false)');
    }
  }

  async onModuleDestroy() {
    if (this.gateway) {
      this.gateway.close();
    }
    if (this.grpcClient) {
      this.grpcClient.close();
    }
  }

  // ── Fabric Gateway 연결 ─────────────────────────────────────────────────────

  private async connect() {
    const { connect } = await import('@hyperledger/fabric-gateway' as any);
    const grpc = await import('@grpc/grpc-js' as any);

    const peerEndpoint = process.env.FABRIC_PEER_ENDPOINT!;
    const tlsCertPath = process.env.FABRIC_TLS_CERT_PATH!;
    const mspId = process.env.FABRIC_MSP_ID ?? 'Org1MSP';

    const tlsCert = fs.readFileSync(tlsCertPath);
    const credentials = grpc.credentials.createSsl(tlsCert);
    this.grpcClient = new grpc.Client(peerEndpoint, credentials);

    const certBase64 = process.env.FABRIC_ADMIN_CERT_BASE64!;
    const keyBase64 = process.env.FABRIC_ADMIN_KEY_BASE64!;
    const certPem = Buffer.from(certBase64, 'base64').toString('utf-8');
    const keyPem = Buffer.from(keyBase64, 'base64').toString('utf-8');

    const identity = { mspId, credentials: Buffer.from(certPem) };
    const privateKey = crypto.createPrivateKey(keyPem);
    const { signers } = await import('@hyperledger/fabric-gateway' as any);
    const signer = signers.newPrivateKeySigner(privateKey);

    this.gateway = connect({
      client: this.grpcClient,
      identity,
      signer,
      evaluateOptions: () => ({ deadline: Date.now() + 5_000 }),
      endorseOptions: () => ({ deadline: Date.now() + 15_000 }),
      submitOptions: () => ({ deadline: Date.now() + 5_000 }),
      commitStatusOptions: () => ({ deadline: Date.now() + 60_000 }),
    });
  }

  private getContract(chaincodeName: string, channelName?: string) {
    const channel = channelName ?? process.env.FABRIC_CHANNEL ?? 'internal-channel';
    const network = this.gateway.getNetwork(channel);
    return network.getContract(chaincodeName);
  }

  private async submitTx(chaincode: string, fn: string, args: string[]): Promise<string> {
    const contract = this.getContract(chaincode);
    const result = await contract.submitTransaction(fn, ...args);
    return Buffer.from(result).toString('utf-8');
  }

  private async evaluateTx(chaincode: string, fn: string, args: string[]): Promise<string> {
    const contract = this.getContract(chaincode);
    const result = await contract.evaluateTransaction(fn, ...args);
    return Buffer.from(result).toString('utf-8');
  }

  // 채널 지정 가능한 버전 (internal-channel / naver-channel)
  private async submit(channel: string, chaincode: string, fn: string, ...args: string[]): Promise<string> {
    const contract = this.getContract(chaincode, channel);
    const result = await contract.submitTransaction(fn, ...args);
    return Buffer.from(result).toString('utf-8');
  }

  private async evaluate(channel: string, chaincode: string, fn: string, ...args: string[]): Promise<string> {
    const contract = this.getContract(chaincode, channel);
    const result = await contract.evaluateTransaction(fn, ...args);
    return Buffer.from(result).toString('utf-8');
  }

  // ── Square Wallet ───────────────────────────────────────────────────────────

  /** Square Wallet 충전 (Toss 결제 확인 후 호출) */
  async depositSquare(userId: string, amount: number, memo: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'DepositSquare', [userId, amount.toString(), memo]);
    }
    this.logger.log(`[Fabric-Demo] DepositSquare | user=${userId} amount=${amount} memo=${memo}`);
    return `square-deposited-${userId}-${amount}`;
  }

  /** Square Wallet 차감 (RP 결제 구매 시 에스크로 락업 전) */
  async deductSquare(userId: string, amount: number, memo: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'DeductSquare', [userId, amount.toString(), memo]);
    }
    this.logger.log(`[Fabric-Demo] DeductSquare | user=${userId} amount=${amount} memo=${memo}`);
    return `square-deducted-${userId}-${amount}`;
  }

  /** Square Wallet 잔액 조회 */
  async getSquareBalance(userId: string): Promise<number> {
    if (this.useFabric) {
      const raw = await this.evaluateTx('wallet', 'GetSquareBalance', [userId]);
      return parseInt(raw, 10) || 0;
    }
    this.logger.log(`[Fabric-Demo] GetSquareBalance | user=${userId}`);
    return 0;
  }

  /** Square Wallet 거래 내역 */
  async getSquareHistory(userId: string): Promise<unknown[]> {
    if (this.useFabric) {
      const raw = await this.evaluateTx('wallet', 'GetSquareHistory', [userId]);
      return JSON.parse(raw) as unknown[];
    }
    this.logger.log(`[Fabric-Demo] GetSquareHistory | user=${userId}`);
    return [];
  }

  // ── Point Wallet ────────────────────────────────────────────────────────────

  /** Point Wallet 적립 (리뷰 보상, 이벤트 등) */
  async issuePoint(userId: string, amount: number, memo: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'IssuePoint', [userId, amount.toString(), memo]);
    }
    this.logger.log(`[Fabric-Demo] IssuePoint | user=${userId} amount=${amount} memo=${memo}`);
    return `point-issued-${userId}-${amount}`;
  }

  /** Point Wallet 사용 (결제 시 할인 적용) */
  async usePoint(userId: string, amount: number, memo: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'UsePoint', [userId, amount.toString(), memo]);
    }
    this.logger.log(`[Fabric-Demo] UsePoint | user=${userId} amount=${amount} memo=${memo}`);
    return `point-used-${userId}-${amount}`;
  }

  /** Point Wallet 잔액 조회 */
  async getPointBalance(userId: string): Promise<number> {
    if (this.useFabric) {
      const raw = await this.evaluateTx('wallet', 'GetPointBalance', [userId]);
      return parseInt(raw, 10) || 0;
    }
    this.logger.log(`[Fabric-Demo] GetPointBalance | user=${userId}`);
    return 0;
  }

  /** Point Wallet 거래 내역 */
  async getPointHistory(userId: string): Promise<unknown[]> {
    if (this.useFabric) {
      const raw = await this.evaluateTx('wallet', 'GetPointHistory', [userId]);
      return JSON.parse(raw) as unknown[];
    }
    this.logger.log(`[Fabric-Demo] GetPointHistory | user=${userId}`);
    return [];
  }

  // ── Admin Wallet / Escrow ───────────────────────────────────────────────────

  /**
   * 에스크로 락업
   * Square 결제: 구매자 Square Wallet에서 차감 + Admin Wallet 예치 (체인코드 내부 처리)
   * Toss 결제: Admin Wallet에 Toss 결제액 기록만 (실제 차감은 Toss에서)
   */
  async lockEscrow(
    orderId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    payMethod: 'SQUARE' | 'TOSS',
    usedPoint = 0,
    autoConfirmAt: Date = new Date(Date.now() + 72 * 3600 * 1000),
  ): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'LockEscrow', [
        orderId,
        buyerId,
        sellerId,
        amount.toString(),
        payMethod,
        usedPoint.toString(),
        Math.floor(autoConfirmAt.getTime() / 1000).toString(),
      ]);
    }
    this.logger.log(
      `[Fabric-Demo] LockEscrow | order=${orderId} buyer=${buyerId} seller=${sellerId} amount=${amount} payMethod=${payMethod} point=${usedPoint}`,
    );
    return `escrow-locked-${orderId}`;
  }

  /**
   * 에스크로 정산 — 구매 확정 시
   * 체인코드: Admin Wallet → 판매자 Square Wallet 90% 이체
   */
  async settleEscrow(orderId: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'SettleEscrow', [orderId]);
    }
    this.logger.log(`[Fabric-Demo] SettleEscrow | order=${orderId}`);
    return `escrow-settled-${orderId}`;
  }

  /**
   * 에스크로 환불 — 신고 인정 시
   * Square 결제: 체인코드가 구매자 Square Wallet으로 반환
   * Toss 결제: 상태만 변경 (NestJS에서 Toss 환불 API 별도 호출)
   */
  async refundEscrow(orderId: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'RefundEscrow', [orderId]);
    }
    this.logger.log(`[Fabric-Demo] RefundEscrow | order=${orderId}`);
    return `escrow-refunded-${orderId}`;
  }

  /**
   * 에스크로 자동 정산 (72시간 오라클 트리거)
   * NestJS 스케줄러가 주기적으로 호출
   */
  async autoSettleEscrow(orderId: string): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'AutoSettleEscrow', [orderId]);
    }
    this.logger.log(`[Fabric-Demo] AutoSettleEscrow | order=${orderId}`);
    return `escrow-auto-settled-${orderId}`;
  }

  /** 에스크로 상태 조회 */
  async getEscrowState(orderId: string): Promise<Record<string, unknown>> {
    if (this.useFabric) {
      const raw = await this.evaluateTx('wallet', 'GetEscrowState', [orderId]);
      return JSON.parse(raw) as Record<string, unknown>;
    }
    this.logger.log(`[Fabric-Demo] GetEscrowState | order=${orderId}`);
    return {
      orderId,
      status: 'LOCKED',
      autoConfirmAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    };
  }

  // ── 거래 원장 ───────────────────────────────────────────────────────────────

  /** 불변 거래 원장 기록 */
  async recordTrade(
    orderId: string,
    productId: string,
    buyerId: string,
    sellerId: string,
    amount: number,
    payMethod: string,
  ): Promise<string> {
    if (this.useFabric) {
      return this.submitTx('wallet', 'RecordTrade', [
        orderId,
        productId,
        buyerId,
        sellerId,
        amount.toString(),
        payMethod,
      ]);
    }
    this.logger.log(
      `[Fabric-Demo] RecordTrade | order=${orderId} product=${productId} amount=${amount} payMethod=${payMethod}`,
    );
    return `trade-recorded-${orderId}`;
  }

  /** 거래 원장 조회 */
  async getTradeRecord(orderId: string): Promise<Record<string, unknown>> {
    if (this.useFabric) {
      const raw = await this.evaluateTx('wallet', 'GetTradeRecord', [orderId]);
      return JSON.parse(raw) as Record<string, unknown>;
    }
    this.logger.log(`[Fabric-Demo] GetTradeRecord | order=${orderId}`);
    return { orderId, status: 'recorded' };
  }

  // ── 레거시 호환 메서드 (기존 PointLog 기반 서비스와 연동) ─────────────────

  /** @deprecated depositSquare() 사용 권장 */
  async issuePoints(userId: string, amount: number, memo: string): Promise<string> {
    return this.depositSquare(userId, amount, memo);
  }

  /** @deprecated deductSquare() 사용 권장 */
  async deductPoints(userId: string, amount: number, memo: string): Promise<string> {
    return this.deductSquare(userId, amount, memo);
  }

  // ── naver-channel / exchange chaincode 호출 ─────────────────────────
  /** 결제 포인트(PAID) → 네이버페이 전환 요청 (PAID 차감 + PENDING 기록) */
  async exchangeToNaver(exchangeId: string, userId: string, amount: number): Promise<string> {
    if (!this.useFabric) {
      this.logger.log(`[Fabric-Demo] ExchangeToNaver | ex=${exchangeId} user=${userId} amt=${amount}`);
      return exchangeId;
    }
    return await this.submit('naver-channel', 'exchange', 'ExchangeToNaver',
      exchangeId, userId, String(amount));
  }

  /** NaverPay가 자기 시스템에서 적립 확정 후 호출 (NaverPayMSP 권한 필요) */
  async confirmNaverExchange(exchangeId: string, naverTxId: string): Promise<string> {
    if (!this.useFabric) {
      this.logger.log(`[Fabric-Demo] ConfirmNaverExchange | ex=${exchangeId} naverTx=${naverTxId}`);
      return exchangeId;
    }
    return await this.submit('naver-channel', 'exchange', 'ConfirmNaverExchange', exchangeId, naverTxId);
  }

  /** PAID 포인트 적립 (충전·결제 캐시백) — naver-channel exchange chaincode */
  async issuePaid(userId: string, amount: number, memo: string): Promise<string> {
    if (!this.useFabric) {
      this.logger.log(`[Fabric-Demo] IssuePaid | user=${userId} amt=${amount} memo=${memo}`);
      return 'demo-paid';
    }
    return await this.submit('naver-channel', 'exchange', 'IssuePaid', userId, String(amount), memo);
  }

  /** PAID 잔액 조회 */
  async getPaidBalance(userId: string): Promise<number> {
    if (!this.useFabric) return 0;
    const res = await this.evaluate('naver-channel', 'exchange', 'GetPaidBalance', userId);
    return parseInt(res || '0', 10);
  }
}

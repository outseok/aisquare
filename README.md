# AISquare — AI 노하우 거래 마켓플레이스

검증된 AI 프롬프트·자동화 시트·강의자료를 안전하게 거래하는 PASS 인증 기반 마켓플레이스.
이중 지갑(Square / Point), 72시간 에스크로, Hyperledger Fabric 변조불가 원장.

```
┌────────────────────────────────────────────────────────────┐
│  frontend/   정적 프로토타입 (HTML/CSS/JS)                  │
│  backend/    NestJS + Prisma + MySQL                       │
│  fabric/     Hyperledger Fabric 2개 채널 + 체인코드 3종      │
│  clamav-lambda/  AWS Lambda ClamAV 바이러스 검사            │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 클론 직후 셋업 (5단계)

### 0. 사전 요구사항

- **Docker** + **Docker Compose v2** (Fabric 컨테이너 실행)
- **Node.js 20+** (NestJS BE)
- **Go 1.21+** (체인코드 빌드)
- **MySQL 접근권** (AWS RDS 또는 로컬)

### 1. 클론

```bash
git clone https://github.com/outseok/aisquare.git
cd aisquare
git checkout WH
```

### 2. `.env` 작성 (Fabric 값 제외)

`backend/.env`를 직접 만들고 아래 키들 채우기. **Fabric 관련 값은 비워두세요** — setup.sh가 출력해 줍니다.

```env
DATABASE_URL="mysql://USER:PASS@HOST:3306/aisquare"
JWT_SECRET="아무 길이의 랜덤 문자열"

# AWS S3 + CloudFront
AWS_REGION="ap-northeast-2"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_S3_BUCKET="..."
AWS_CLOUDFRONT_DOMAIN="..."
AWS_CLOUDFRONT_KEY_PAIR_ID="..."
AWS_CLOUDFRONT_PRIVATE_KEY="..."  # base64 한 줄

# Toss Payments (test or live)
TOSS_SECRET_KEY="test_sk_..."
TOSS_CLIENT_KEY="test_ck_..."

# PortOne PASS 본인인증
IMP_CODE="..."
IMP_KEY="..."
IMP_SECRET="..."

# Pinata IPFS / Google Safe Browsing / Slack
PINATA_JWT="..."
GOOGLE_SAFE_BROWSING_API_KEY="..."
SLACK_WEBHOOK_URL="..."
AWS_CLAMAV_LAMBDA_ARN="..."

# Misc
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:8000"
ADMIN_USERNAMES="admin"

# ── Fabric (아래는 setup.sh 실행 후 추가) ──
# FABRIC_ENABLED=...
```

### 3. Fabric 네트워크 자동 부트스트랩

```bash
cd fabric
./setup.sh
```

이 스크립트가 자동으로 처리하는 것:

1. **Fabric 바이너리 다운로드** (`cryptogen`, `configtxgen`, `peer`, `osnadmin`)
2. **인증서 발급** (Orderer + AISquare + NaverPay 조직, cryptogen 사용)
3. **Genesis blocks 생성** (`internal-channel`, `naver-channel`)
4. **Docker 컨테이너 기동** (orderer + AISquare peer + NaverPay peer + CLI)
5. **채널 생성** (osnadmin) + **peer join**
6. **체인코드 배포**:
   - `exchange` → `naver-channel` (AISquare + NaverPay 양 조직 승인)
   - `wallet` → `internal-channel` (AISquare 단독)
7. **`.env` 추가용 Fabric 값 출력** (cert/key를 base64로 인코딩해서 copy-paste 가능하게)

스크립트 마지막 출력에서:

```
↓ backend/.env 에 아래 값을 추가하세요:

FABRIC_ENABLED="true"
FABRIC_PEER_ENDPOINT="localhost:7051"
FABRIC_TLS_CERT_PATH="/abs/path/.../ca.crt"
FABRIC_MSP_ID="AISquareMSP"
FABRIC_ADMIN_CERT_BASE64="LS0tLS1CRUdJTi..."
FABRIC_ADMIN_KEY_BASE64="LS0tLS1CRUdJTi..."
```

이 6줄을 `backend/.env`에 추가하세요.

### 4. BE 기동

```bash
cd ../backend
npm install
npx prisma generate
npx prisma db push    # RDS에 스키마 동기화 (처음 한 번만)
npm run seed          # 시드 데이터 + 기본 관리자 계정 생성
npx nest start
```

> **🛡 기본 관리자 계정** (즉시 admin.html 사용 가능)
> - username: `admin`
> - password: `admin123`
> - **운영 전 반드시 비밀번호 변경**. 또는 `.env`의 `ADMIN_USERNAMES`를 자기 username으로 바꿔 다시 가입.

`[FabricService] Fabric Gateway 연결 성공` 로그가 뜨면 BE가 진짜 peer에 연결된 것.

### 5. 프론트엔드 기동

```bash
cd ../frontend
python3 -m http.server 8000
# 또는 npx http-server -p 8000
```

브라우저에서 `http://localhost:8000` 접속.

---

## 🔄 재실행 / 정리

### Fabric 네트워크만 끄기 (데이터 유지)

```bash
cd fabric/network
docker compose stop
```

### 완전히 초기화 (인증서·블록 다 지움)

```bash
cd fabric/network
docker compose down -v
rm -rf crypto-config channel-artifacts
# 다시 ../setup.sh 실행
```

### setup.sh 재실행 (idempotent)

이미 만들어진 자산(crypto-config/, channel-artifacts/, 컨테이너)은 그대로 두고 빠진 단계만 채웁니다. 안전하게 여러 번 실행 가능.

---

## 🏗 아키텍처

### Fabric 채널 구성

| 채널 | 조직 | 체인코드 | 용도 |
|------|------|---------|------|
| `internal-channel` | AISquare 단독 | `wallet` | Square 지갑·ACTIVITY 포인트·에스크로 |
| `naver-channel` | AISquare + NaverPay | `exchange` | PAID 포인트·NaverPay 전환 원장 |

### 이중 포인트 시스템

| 카테고리 | 적립 방식 | 사용처 |
|---------|---------|--------|
| **PAID** | 충전, 구매 캐시백 | 사이트 결제 + **NaverPay 전환 가능** |
| **ACTIVITY** | 리뷰 작성, 이벤트 | 사이트 결제 할인 전용 (전환 불가) |

### 수수료 정책

- **표시 가격 = 가격(Amount)** — 예: 10,000 Square
- **구매자 결제액(PayAmount) = 가격 × 1.05** — 예: 10,500 Square (가격 위에 5% 추가)
- **판매자 정산 = 가격의 95%** — 예: 9,500 Square (가격에서 5% 차감)
- **판매자 캐시백 = 가격의 2% (Square)** — 구매 확정 시 Square Wallet에 적립
- **구매자 캐시백 = 가격의 2% (Square)** — 구매 확정 시 Square Wallet에 적립
- **플랫폼 수익 = PayAmount − 정산 − 양쪽 캐시백 = 가격의 6%**
- 양쪽 모두 5% 부담 / 양쪽 모두 2% Square 캐시백 적립 (adminLog 기록)

### 신뢰토큰 (0~100)

- 시작 **10**
- 거래 확정: **+1**
- 5점 리뷰: **+0.5**
- 저점 리뷰: **−0.5**
- 신고 인정 / 강제 환불: **즉시 0으로 초기화**

---

## 🛡 관리자 콘솔

`isAdmin=true` 사용자는 헤더 우측에 **관리자** 칩 자동 노출 → `/admin.html`:

| 탭 | 기능 |
|----|------|
| 대시보드 | 정산 통계 8개 카드 |
| 사용자 | 정지/복원/탈퇴, 신뢰토큰 수동 조정 |
| 신고 처리 | 환불(REFUNDED) / 기각(APPROVED) — Fabric escrow 연동 |
| 상품 관리 | 노출/숨김 토글 |
| NaverPay 전환 | PENDING 전환 승인/거부 (거부 시 PAID 자동 환불) |
| 액션 로그 | 관리자 활동 이력 |

관리자 만들기: `backend/.env`의 `ADMIN_USERNAMES="admin,sub_admin"` 콤마 구분으로 username 추가 → 그 이름으로 회원가입.

---

## 📂 디렉토리 구조

```
aisquare/
├── README.md                ← 이 문서
├── .gitignore
├── frontend/                ← 정적 HTML 프로토타입
│   ├── index.html / market.html / product.html / ...
│   ├── admin.html           ← 관리자 콘솔
│   ├── checkout.html        ← Toss/Square/Point 복합 결제
│   ├── styles.css / app.js / api.js
│   └── assets/
├── backend/                 ← NestJS API 서버
│   ├── src/
│   │   ├── auth/            ← JWT + PortOne PASS
│   │   ├── orders/          ← 주문·에스크로·자동 정산
│   │   ├── payments/        ← Toss 결제 + Square 충전
│   │   ├── points/          ← PAID/ACTIVITY 분리 + NaverPay 전환
│   │   ├── admin/           ← 신고·사용자·전환 관리
│   │   ├── fabric/          ← Fabric Gateway SDK 래퍼
│   │   ├── scheduler/       ← 72h Cron autoConfirm
│   │   └── ...
│   ├── prisma/schema.prisma
│   └── .env                 ← (gitignored) 외부 키들
├── fabric/                  ← Hyperledger Fabric
│   ├── setup.sh             ← 자동 부트스트랩 스크립트
│   ├── chaincode/
│   │   ├── exchange/        ← PAID 포인트 + NaverPay 전환 원장
│   │   └── wallet/          ← Square 지갑 + 에스크로
│   └── network/
│       ├── docker-compose.yaml
│       ├── configtx.yaml    ← 2개 채널 Profile
│       ├── crypto-config.yaml
│       └── crypto-config/   ← (gitignored) cryptogen 출력
└── clamav-lambda/           ← AWS Lambda ClamAV 바이러스 검사
```

---

## 📊 BE 주요 엔드포인트

| 카테고리 | 엔드포인트 |
|---------|----------|
| 인증 | `POST /auth/register`, `/auth/login`, PASS `/auth/pass/start` `/auth/pass/verify` |
| 상품 | `GET/POST /products`, `GET /products/:id` |
| 주문 | `POST /orders/:productId`, `POST /orders/:id/pay/toss` `/pay/square`, `POST /orders/:id/confirm` |
| 지갑 | `GET /square/balance`, `POST /square/charge` |
| 포인트 | `GET /points/balance/paid` `/balance/activity`, **`POST /points/exchange-naver`** |
| 신고 | `POST /reports/order/:id`, `GET /reports/me` |
| 관리자 | `GET /admin/{users,reports,naver-exchanges,settlement/stats,unread-count,...}` |

---

## ❓ Troubleshooting

| 증상 | 원인·해결 |
|------|---------|
| `Fabric Gateway 연결 실패` | Docker 컨테이너 안 떴거나 `.env`의 `FABRIC_*` 값 잘못. `docker ps`로 `peer0.aisquare.com` 확인, `setup.sh` 재실행. |
| `Pulling fabric-ccenv 실패` | 네트워크 또는 Docker Hub 접속 문제. 수동으로 `docker pull hyperledger/fabric-ccenv:2.5`. |
| BE 시작 시 Prisma 에러 | `npx prisma db push` 안 했을 수 있음. RDS 접근 안 되면 `DATABASE_URL` 확인. |
| 신고/전환이 admin에 안 보임 | 30초 폴링이라 잠시 기다리거나 페이지 새로고침. |
| Toss `INVALID_API_KEY` | `TOSS_SECRET_KEY`가 잘못. Toss 콘솔에서 다시 발급. |

---

## 🤝 팀

| 역할 | 담당자 |
|------|------|
| FE1 | 최유리 — 회원·마이페이지·지갑·상품등록·판매자 프로필 |
| FE2 | 장우혁 — 마켓·상품상세·결제·찜/장바구니 |
| BE1 | 홍인석 — API 서버·인증·결제 연동·파일 처리 |
| BE2 | 홍재창 — Fabric 지갑·에스크로·체인코드·Gateway |

---

© 2026 AISquare Inc.

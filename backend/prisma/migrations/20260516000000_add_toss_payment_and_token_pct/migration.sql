-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 토스 페이먼츠 연동 + 토큰 퍼센테이지 + RP 원장 확장
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. User에 tokenPercentage 추가 (기본값 10%)
ALTER TABLE "users" ADD COLUMN "tokenPercentage" INTEGER NOT NULL DEFAULT 10;

-- 2. Product에 priceRp 추가 (RP 단위 가격 직접 저장)
ALTER TABLE "products" ADD COLUMN "priceRp" INTEGER;

-- 3. PayMethod enum에 TOSS 추가
ALTER TYPE "PayMethod" ADD VALUE 'TOSS';

-- 4. PointLogType enum 확장
ALTER TYPE "PointLogType" ADD VALUE 'CHARGE_BONUS';
ALTER TYPE "PointLogType" ADD VALUE 'REVIEW_BONUS';
ALTER TYPE "PointLogType" ADD VALUE 'WITHDRAW';

-- 5. TossPayPurpose enum 생성
CREATE TYPE "TossPayPurpose" AS ENUM ('RP_CHARGE', 'PRODUCT_PURCHASE');

-- 6. TossPayStatus enum 생성
CREATE TYPE "TossPayStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED');

-- 7. TossPayment 테이블 생성
CREATE TABLE "toss_payments" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "tossOrderId" TEXT NOT NULL,
    "paymentKey"  TEXT,
    "amount"      INTEGER NOT NULL,
    "purpose"     "TossPayPurpose" NOT NULL,
    "status"      "TossPayStatus" NOT NULL DEFAULT 'PENDING',
    "rpGranted"   INTEGER,
    "relatedId"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "toss_payments_pkey" PRIMARY KEY ("id")
);

-- 8. TossPayment 유니크 제약 및 외래키
CREATE UNIQUE INDEX "toss_payments_tossOrderId_key" ON "toss_payments"("tossOrderId");

ALTER TABLE "toss_payments"
    ADD CONSTRAINT "toss_payments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

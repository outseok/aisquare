-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Square Wallet 결제 방식 추가 (기획안 v5.0 이중 지갑 체계 반영)
--
-- 변경 사항:
--   1. PayMethod enum에 SQUARE 추가 (Square Wallet 직접 결제)
--   2. TossPayPurpose enum에 SQUARE_CHARGE 추가 (Square 충전 목적)
--
-- Square Wallet 잔액/거래 내역은 Hyperledger Fabric 원장에서 관리 (DB 저장 X)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. PayMethod enum에 SQUARE 추가
ALTER TYPE "PayMethod" ADD VALUE 'SQUARE';

-- 2. TossPayPurpose enum에 SQUARE_CHARGE 추가
ALTER TYPE "TossPayPurpose" ADD VALUE 'SQUARE_CHARGE';

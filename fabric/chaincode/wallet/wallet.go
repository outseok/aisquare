// Package main implements the Recode AI unified wallet chaincode on Hyperledger Fabric.
//
// 지갑 체인코드: Square Wallet, Point Wallet, Admin Wallet(에스크로) 통합 관리
//
// Square Wallet: Toss 충전 및 판매 수익 보관 (1 Square = 1 KRW)
// Point Wallet : 리뷰 보상 등 활동 포인트 보관 (출금 불가, 결제 할인용)
// Admin Wallet : 에스크로 예치 — 구매 확정 후 판매자 Square Wallet으로 정산
//
// 지원 트랜잭션:
//   Square Wallet
//     DepositSquare     : 충전 또는 판매 정산 입금
//     DeductSquare      : 구매 차감
//     GetSquareBalance  : 잔액 조회
//     GetSquareHistory  : 거래 내역 조회
//
//   Point Wallet
//     IssuePoint        : 포인트 적립
//     UsePoint          : 포인트 사용 (결제 할인)
//     GetPointBalance   : 잔액 조회
//     GetPointHistory   : 거래 내역 조회
//
//   Admin Wallet / Escrow
//     LockEscrow        : 구매 시 대금 예치 (Admin Wallet으로 이동)
//     SettleEscrow      : 구매 확정 시 판매자 Square Wallet으로 90% 정산
//     RefundEscrow      : 신고 인정 시 구매자에게 환불 처리
//     GetEscrowState    : 에스크로 상태 조회
//     AutoSettleEscrow  : 72시간 자동 정산 (NestJS 스케줄러가 오라클로 호출)
//
//   Trade Ledger
//     RecordTrade       : 불변 거래 원장 기록
//     GetTradeRecord    : 거래 원장 조회
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// WalletContract — Recode AI 통합 지갑 스마트 컨트랙트
type WalletContract struct {
	contractapi.Contract
}

// ── 상태 구조체 ────────────────────────────────────────────────────────────────

// WalletBalance — Square / Point 지갑 잔액 상태
type WalletBalance struct {
	UserID     string    `json:"userId"`
	WalletType string    `json:"walletType"` // SQUARE | POINT
	Balance    int64     `json:"balance"`    // KRW 단위 (1:1)
	UpdatedAt  time.Time `json:"updatedAt"`
}

// WalletTx — 지갑 거래 내역 항목
type WalletTx struct {
	TxID       string    `json:"txId"`
	UserID     string    `json:"userId"`
	WalletType string    `json:"walletType"` // SQUARE | POINT
	TxType     string    `json:"txType"`     // DEPOSIT|DEDUCT|ISSUE|USE|SETTLEMENT|REFUND
	Amount     int64     `json:"amount"`     // 양수=입금 음수=출금
	Balance    int64     `json:"balance"`    // 거래 후 잔액
	Memo       string    `json:"memo"`
	Timestamp  time.Time `json:"timestamp"`
}

// EscrowState — Admin Wallet 에스크로 상태
// 수수료 구조: 총 10% = 서버 6% + 판매자 보너스 2% + 구매자 캐시백 2%
type EscrowState struct {
	OrderID        string    `json:"orderId"`
	BuyerID        string    `json:"buyerId"`
	SellerID       string    `json:"sellerId"`
	Amount         int64     `json:"amount"`         // 총 결제액 (KRW)
	PlatformFee    int64     `json:"platformFee"`    // 서버 수수료 6%
	SellerBonus    int64     `json:"sellerBonus"`    // 판매자 수수료 환급 2%
	BuyerCashback  int64     `json:"buyerCashback"`  // 구매자 캐시백 2%
	SellerNet      int64     `json:"sellerNet"`      // 판매자 수익금 90%
	PayMethod      string    `json:"payMethod"`      // SQUARE | TOSS
	UsedPoint      int64     `json:"usedPoint"`      // Point Wallet 할인 적용액
	Status         string    `json:"status"`         // LOCKED | SETTLED | REFUNDED
	AutoConfirmAt  time.Time `json:"autoConfirmAt"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// TradeRecord — 불변 거래 원장
type TradeRecord struct {
	OrderID   string    `json:"orderId"`
	ProductID string    `json:"productId"`
	BuyerID   string    `json:"buyerId"`
	SellerID  string    `json:"sellerId"`
	Amount    int64     `json:"amount"`
	PayMethod string    `json:"payMethod"`
	CreatedAt time.Time `json:"createdAt"`
}

// ── 상태 키 상수 ──────────────────────────────────────────────────────────────

const (
	squareBalPrefix = "SQ_BAL_"
	squareHisPrefix = "SQ_HIS_"
	pointBalPrefix  = "PT_BAL_"
	pointHisPrefix  = "PT_HIS_"
	escrowPrefix    = "ESC_"
	tradePrefix     = "TRADE_"

	// 수수료 구조 (총 10%)
	platformFeeRate   = 6  // 서버 귀속 6%
	sellerBonusRate   = 2  // 판매자 수수료 환급 2%
	buyerCashbackRate = 2  // 구매자 캐시백 2%
	// sellerNet = 100 - 6 - 2 - 2 = 90%
)

// ── Square Wallet ──────────────────────────────────────────────────────────────

// DepositSquare — Square Wallet 충전 또는 판매 수익 입금
func (c *WalletContract) DepositSquare(ctx contractapi.TransactionContextInterface,
	userID, amountStr, memo string) (string, error) {

	amount, err := parsePositiveInt(amountStr)
	if err != nil {
		return "", fmt.Errorf("유효하지 않은 금액: %s", amountStr)
	}

	balance, err := c.getWalletBalance(ctx, squareBalPrefix, userID)
	if err != nil {
		return "", err
	}

	newBalance := balance + amount
	if err := c.saveWalletBalance(ctx, squareBalPrefix, userID, "SQUARE", newBalance); err != nil {
		return "", err
	}
	if err := c.appendWalletHistory(ctx, squareHisPrefix, userID, "SQUARE", "DEPOSIT", amount, newBalance, memo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{"userId": userID, "amount": amount, "balance": newBalance})
	_ = ctx.GetStub().SetEvent("SquareDeposited", eventData)

	return fmt.Sprintf("Square 충전 완료: user=%s amount=%d balance=%d", userID, amount, newBalance), nil
}

// DeductSquare — Square Wallet 차감 (구매 결제)
func (c *WalletContract) DeductSquare(ctx contractapi.TransactionContextInterface,
	userID, amountStr, memo string) (string, error) {

	amount, err := parsePositiveInt(amountStr)
	if err != nil {
		return "", fmt.Errorf("유효하지 않은 금액: %s", amountStr)
	}

	balance, err := c.getWalletBalance(ctx, squareBalPrefix, userID)
	if err != nil {
		return "", err
	}
	if balance < amount {
		return "", fmt.Errorf("Square Wallet 잔액 부족: 보유=%d 필요=%d", balance, amount)
	}

	newBalance := balance - amount
	if err := c.saveWalletBalance(ctx, squareBalPrefix, userID, "SQUARE", newBalance); err != nil {
		return "", err
	}
	if err := c.appendWalletHistory(ctx, squareHisPrefix, userID, "SQUARE", "DEDUCT", -amount, newBalance, memo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{"userId": userID, "amount": amount, "balance": newBalance})
	_ = ctx.GetStub().SetEvent("SquareDeducted", eventData)

	return fmt.Sprintf("Square 차감 완료: user=%s amount=%d balance=%d", userID, amount, newBalance), nil
}

// GetSquareBalance — Square Wallet 잔액 조회
func (c *WalletContract) GetSquareBalance(ctx contractapi.TransactionContextInterface,
	userID string) (string, error) {

	balance, err := c.getWalletBalance(ctx, squareBalPrefix, userID)
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(balance, 10), nil
}

// GetSquareHistory — Square Wallet 거래 내역 조회
func (c *WalletContract) GetSquareHistory(ctx contractapi.TransactionContextInterface,
	userID string) (string, error) {

	return c.getWalletHistory(ctx, squareHisPrefix, userID)
}

// ── Point Wallet ───────────────────────────────────────────────────────────────

// IssuePoint — Point Wallet 적립 (리뷰 보상, 이벤트 등)
func (c *WalletContract) IssuePoint(ctx contractapi.TransactionContextInterface,
	userID, amountStr, memo string) (string, error) {

	amount, err := parsePositiveInt(amountStr)
	if err != nil {
		return "", fmt.Errorf("유효하지 않은 포인트: %s", amountStr)
	}

	balance, err := c.getWalletBalance(ctx, pointBalPrefix, userID)
	if err != nil {
		return "", err
	}

	newBalance := balance + amount
	if err := c.saveWalletBalance(ctx, pointBalPrefix, userID, "POINT", newBalance); err != nil {
		return "", err
	}
	if err := c.appendWalletHistory(ctx, pointHisPrefix, userID, "POINT", "ISSUE", amount, newBalance, memo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{"userId": userID, "amount": amount, "balance": newBalance})
	_ = ctx.GetStub().SetEvent("PointIssued", eventData)

	return fmt.Sprintf("포인트 적립 완료: user=%s amount=%d balance=%d", userID, amount, newBalance), nil
}

// UsePoint — Point Wallet 사용 (결제 시 할인 적용)
func (c *WalletContract) UsePoint(ctx contractapi.TransactionContextInterface,
	userID, amountStr, memo string) (string, error) {

	amount, err := parsePositiveInt(amountStr)
	if err != nil {
		return "", fmt.Errorf("유효하지 않은 포인트: %s", amountStr)
	}

	balance, err := c.getWalletBalance(ctx, pointBalPrefix, userID)
	if err != nil {
		return "", err
	}
	if balance < amount {
		return "", fmt.Errorf("Point Wallet 잔액 부족: 보유=%d 필요=%d", balance, amount)
	}

	newBalance := balance - amount
	if err := c.saveWalletBalance(ctx, pointBalPrefix, userID, "POINT", newBalance); err != nil {
		return "", err
	}
	if err := c.appendWalletHistory(ctx, pointHisPrefix, userID, "POINT", "USE", -amount, newBalance, memo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{"userId": userID, "amount": amount, "balance": newBalance})
	_ = ctx.GetStub().SetEvent("PointUsed", eventData)

	return fmt.Sprintf("포인트 사용 완료: user=%s amount=%d balance=%d", userID, amount, newBalance), nil
}

// GetPointBalance — Point Wallet 잔액 조회
func (c *WalletContract) GetPointBalance(ctx contractapi.TransactionContextInterface,
	userID string) (string, error) {

	balance, err := c.getWalletBalance(ctx, pointBalPrefix, userID)
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(balance, 10), nil
}

// GetPointHistory — Point Wallet 거래 내역 조회
func (c *WalletContract) GetPointHistory(ctx contractapi.TransactionContextInterface,
	userID string) (string, error) {

	return c.getWalletHistory(ctx, pointHisPrefix, userID)
}

// ── Admin Wallet / Escrow ──────────────────────────────────────────────────────

// LockEscrow — 구매 시 대금을 Admin Wallet에 예치
// autoConfirmAtUnix: Unix timestamp (초) 문자열
func (c *WalletContract) LockEscrow(ctx contractapi.TransactionContextInterface,
	orderID, buyerID, sellerID, amountStr, payMethod, usedPointStr, autoConfirmAtUnix string) (string, error) {

	amount, err := parsePositiveInt(amountStr)
	if err != nil {
		return "", fmt.Errorf("유효하지 않은 금액: %s", amountStr)
	}
	usedPoint, _ := strconv.ParseInt(usedPointStr, 10, 64)
	autoConfirmUnix, _ := strconv.ParseInt(autoConfirmAtUnix, 10, 64)
	autoConfirmAt := time.Unix(autoConfirmUnix, 0).UTC()

	// 이미 에스크로 존재 여부 확인
	key := escrowPrefix + orderID
	existing, _ := ctx.GetStub().GetState(key)
	if existing != nil {
		return "", fmt.Errorf("에스크로가 이미 존재합니다: %s", orderID)
	}

	platformFee   := amount * platformFeeRate / 100   // 서버 6%
	sellerBonus   := amount * sellerBonusRate / 100   // 판매자 2%
	buyerCashback := amount * buyerCashbackRate / 100 // 구매자 2%
	sellerNet     := amount - platformFee - sellerBonus - buyerCashback // 90%

	now := time.Now().UTC()
	state := &EscrowState{
		OrderID:       orderID,
		BuyerID:       buyerID,
		SellerID:      sellerID,
		Amount:        amount,
		PlatformFee:   platformFee,
		SellerBonus:   sellerBonus,
		BuyerCashback: buyerCashback,
		SellerNet:     sellerNet,
		PayMethod:     payMethod,
		UsedPoint:     usedPoint,
		Status:        "LOCKED",
		AutoConfirmAt: autoConfirmAt,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	// Square 결제인 경우 구매자 Square Wallet에서 차감
	if payMethod == "SQUARE" {
		squareAmount := amount - usedPoint // 포인트 할인 제외 후 Square에서 차감
		if squareAmount > 0 {
			buyerBalance, err := c.getWalletBalance(ctx, squareBalPrefix, buyerID)
			if err != nil {
				return "", err
			}
			if buyerBalance < squareAmount {
				return "", fmt.Errorf("Square Wallet 잔액 부족: 보유=%d 필요=%d", buyerBalance, squareAmount)
			}
			newBuyerBalance := buyerBalance - squareAmount
			if err := c.saveWalletBalance(ctx, squareBalPrefix, buyerID, "SQUARE", newBuyerBalance); err != nil {
				return "", err
			}
			memo := fmt.Sprintf("구매 에스크로 예치: order=%s", orderID)
			if err := c.appendWalletHistory(ctx, squareHisPrefix, buyerID, "SQUARE", "DEDUCT", -squareAmount, newBuyerBalance, memo, ctx.GetStub().GetTxID()); err != nil {
				return "", err
			}
		}
	}

	bytes, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	if err := ctx.GetStub().PutState(key, bytes); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"orderId":  orderID,
		"buyerId":  buyerID,
		"sellerId": sellerID,
		"amount":   amount,
	})
	_ = ctx.GetStub().SetEvent("EscrowLocked", eventData)

	return fmt.Sprintf("에스크로 예치 완료: order=%s amount=%d payMethod=%s", orderID, amount, payMethod), nil
}

// SettleEscrow — 구매 확정 시 판매자 Square Wallet으로 90% 정산
func (c *WalletContract) SettleEscrow(ctx contractapi.TransactionContextInterface,
	orderID string) (string, error) {

	state, err := c.getEscrowState(ctx, orderID)
	if err != nil {
		return "", err
	}
	if state.Status != "LOCKED" {
		return "", fmt.Errorf("락업 상태가 아닙니다: %s (현재: %s)", orderID, state.Status)
	}

	// 판매자 Square Wallet: 수익금 90% + 수수료 환급 2% = 92%
	sellerTotal := state.SellerNet + state.SellerBonus
	sellerBalance, err := c.getWalletBalance(ctx, squareBalPrefix, state.SellerID)
	if err != nil {
		return "", err
	}
	newSellerBalance := sellerBalance + sellerTotal
	if err := c.saveWalletBalance(ctx, squareBalPrefix, state.SellerID, "SQUARE", newSellerBalance); err != nil {
		return "", err
	}
	sellerMemo := fmt.Sprintf("판매 정산 수익금90%%+보너스2%%=%d: order=%s 서버수수료=%d", sellerTotal, orderID, state.PlatformFee)
	if err := c.appendWalletHistory(ctx, squareHisPrefix, state.SellerID, "SQUARE", "SETTLEMENT", sellerTotal, newSellerBalance, sellerMemo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	// 구매자 Point Wallet: 캐시백 2%
	buyerPointBalance, err := c.getWalletBalance(ctx, pointBalPrefix, state.BuyerID)
	if err != nil {
		return "", err
	}
	newBuyerPointBalance := buyerPointBalance + state.BuyerCashback
	if err := c.saveWalletBalance(ctx, pointBalPrefix, state.BuyerID, "POINT", newBuyerPointBalance); err != nil {
		return "", err
	}
	buyerMemo := fmt.Sprintf("구매 캐시백 2%%=%d: order=%s", state.BuyerCashback, orderID)
	if err := c.appendWalletHistory(ctx, pointHisPrefix, state.BuyerID, "POINT", "ISSUE", state.BuyerCashback, newBuyerPointBalance, buyerMemo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	// 에스크로 상태 업데이트
	state.Status = "SETTLED"
	state.UpdatedAt = time.Now().UTC()
	bytes, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	if err := ctx.GetStub().PutState(escrowPrefix+orderID, bytes); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"orderId":       orderID,
		"sellerId":      state.SellerID,
		"buyerId":       state.BuyerID,
		"sellerNet":     state.SellerNet,
		"sellerBonus":   state.SellerBonus,
		"sellerTotal":   sellerTotal,
		"buyerCashback": state.BuyerCashback,
		"platformFee":   state.PlatformFee,
	})
	_ = ctx.GetStub().SetEvent("EscrowSettled", eventData)

	return fmt.Sprintf("에스크로 정산 완료: order=%s seller=%s total=%d(net=%d+bonus=%d) buyer cashback=%d platform=%d",
		orderID, state.SellerID, sellerTotal, state.SellerNet, state.SellerBonus, state.BuyerCashback, state.PlatformFee), nil
}

// RefundEscrow — 신고 인정 시 구매자에게 환불
// Square 결제: 구매자 Square Wallet으로 환불
// Toss 결제: 상태만 REFUNDED로 변경 (실제 Toss 환불은 NestJS에서 처리)
func (c *WalletContract) RefundEscrow(ctx contractapi.TransactionContextInterface,
	orderID string) (string, error) {

	state, err := c.getEscrowState(ctx, orderID)
	if err != nil {
		return "", err
	}
	if state.Status != "LOCKED" {
		return "", fmt.Errorf("락업 상태가 아닙니다: %s (현재: %s)", orderID, state.Status)
	}

	// Square 결제인 경우 구매자 Square Wallet으로 환불
	if state.PayMethod == "SQUARE" {
		refundAmount := state.Amount - state.UsedPoint
		if refundAmount > 0 {
			buyerBalance, err := c.getWalletBalance(ctx, squareBalPrefix, state.BuyerID)
			if err != nil {
				return "", err
			}
			newBuyerBalance := buyerBalance + refundAmount
			if err := c.saveWalletBalance(ctx, squareBalPrefix, state.BuyerID, "SQUARE", newBuyerBalance); err != nil {
				return "", err
			}
			memo := fmt.Sprintf("신고 환불: order=%s", orderID)
			if err := c.appendWalletHistory(ctx, squareHisPrefix, state.BuyerID, "SQUARE", "REFUND", refundAmount, newBuyerBalance, memo, ctx.GetStub().GetTxID()); err != nil {
				return "", err
			}
		}
		// 사용한 포인트도 복구
		if state.UsedPoint > 0 {
			pointBalance, err := c.getWalletBalance(ctx, pointBalPrefix, state.BuyerID)
			if err != nil {
				return "", err
			}
			newPointBalance := pointBalance + state.UsedPoint
			if err := c.saveWalletBalance(ctx, pointBalPrefix, state.BuyerID, "POINT", newPointBalance); err != nil {
				return "", err
			}
			memo := fmt.Sprintf("신고 환불 포인트 복구: order=%s", orderID)
			if err := c.appendWalletHistory(ctx, pointHisPrefix, state.BuyerID, "POINT", "ISSUE", state.UsedPoint, newPointBalance, memo, ctx.GetStub().GetTxID()); err != nil {
				return "", err
			}
		}
	}
	// Toss 결제 환불은 NestJS 서비스에서 Toss API 호출로 처리

	state.Status = "REFUNDED"
	state.UpdatedAt = time.Now().UTC()
	bytes, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	if err := ctx.GetStub().PutState(escrowPrefix+orderID, bytes); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"orderId":   orderID,
		"buyerId":   state.BuyerID,
		"amount":    state.Amount,
		"payMethod": state.PayMethod,
	})
	_ = ctx.GetStub().SetEvent("EscrowRefunded", eventData)

	return fmt.Sprintf("에스크로 환불 완료: order=%s buyer=%s amount=%d payMethod=%s",
		orderID, state.BuyerID, state.Amount, state.PayMethod), nil
}

// AutoSettleEscrow — 72시간 경과 자동 정산 (NestJS 스케줄러 오라클이 호출)
func (c *WalletContract) AutoSettleEscrow(ctx contractapi.TransactionContextInterface,
	orderID string) (string, error) {

	state, err := c.getEscrowState(ctx, orderID)
	if err != nil {
		return "", err
	}
	if state.Status != "LOCKED" {
		return "", fmt.Errorf("자동 정산 불가 상태: %s", state.Status)
	}

	now := time.Now().UTC()
	if now.Before(state.AutoConfirmAt) {
		return "", fmt.Errorf("아직 자동 정산 시간이 되지 않았습니다. 확정 예정: %s", state.AutoConfirmAt.Format(time.RFC3339))
	}

	// SettleEscrow와 동일한 정산 로직 수행
	return c.SettleEscrow(ctx, orderID)
}

// GetEscrowState — 에스크로 상태 조회
func (c *WalletContract) GetEscrowState(ctx contractapi.TransactionContextInterface,
	orderID string) (*EscrowState, error) {

	return c.getEscrowState(ctx, orderID)
}

// ── Trade Ledger ───────────────────────────────────────────────────────────────

// RecordTrade — 불변 거래 원장 기록
func (c *WalletContract) RecordTrade(ctx contractapi.TransactionContextInterface,
	orderID, productID, buyerID, sellerID, amountStr, payMethod string) (string, error) {

	amount, err := parsePositiveInt(amountStr)
	if err != nil {
		return "", fmt.Errorf("유효하지 않은 금액: %s", amountStr)
	}

	key := tradePrefix + orderID
	existing, _ := ctx.GetStub().GetState(key)
	if existing != nil {
		return "", fmt.Errorf("거래 기록이 이미 존재합니다: %s", orderID)
	}

	record := &TradeRecord{
		OrderID:   orderID,
		ProductID: productID,
		BuyerID:   buyerID,
		SellerID:  sellerID,
		Amount:    amount,
		PayMethod: payMethod,
		CreatedAt: time.Now().UTC(),
	}

	bytes, err := json.Marshal(record)
	if err != nil {
		return "", err
	}
	if err := ctx.GetStub().PutState(key, bytes); err != nil {
		return "", err
	}

	return fmt.Sprintf("거래 원장 기록 완료: order=%s", orderID), nil
}

// GetTradeRecord — 거래 원장 조회
func (c *WalletContract) GetTradeRecord(ctx contractapi.TransactionContextInterface,
	orderID string) (*TradeRecord, error) {

	key := tradePrefix + orderID
	bytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("거래 조회 실패: %v", err)
	}
	if bytes == nil {
		return nil, fmt.Errorf("거래 기록 없음: %s", orderID)
	}

	var record TradeRecord
	if err := json.Unmarshal(bytes, &record); err != nil {
		return nil, err
	}
	return &record, nil
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

func (c *WalletContract) getWalletBalance(ctx contractapi.TransactionContextInterface,
	prefix, userID string) (int64, error) {

	bytes, err := ctx.GetStub().GetState(prefix + userID)
	if err != nil {
		return 0, fmt.Errorf("잔액 조회 실패: %v", err)
	}
	if bytes == nil {
		return 0, nil
	}
	var wb WalletBalance
	if err := json.Unmarshal(bytes, &wb); err != nil {
		return 0, err
	}
	return wb.Balance, nil
}

func (c *WalletContract) saveWalletBalance(ctx contractapi.TransactionContextInterface,
	prefix, userID, walletType string, balance int64) error {

	wb := &WalletBalance{
		UserID:     userID,
		WalletType: walletType,
		Balance:    balance,
		UpdatedAt:  time.Now().UTC(),
	}
	bytes, err := json.Marshal(wb)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(prefix+userID, bytes)
}

func (c *WalletContract) appendWalletHistory(ctx contractapi.TransactionContextInterface,
	prefix, userID, walletType, txType string, amount, balance int64, memo, txID string) error {

	key := prefix + userID
	existing, _ := ctx.GetStub().GetState(key)

	var history []WalletTx
	if existing != nil {
		_ = json.Unmarshal(existing, &history)
	}

	entry := WalletTx{
		TxID:       txID,
		UserID:     userID,
		WalletType: walletType,
		TxType:     txType,
		Amount:     amount,
		Balance:    balance,
		Memo:       memo,
		Timestamp:  time.Now().UTC(),
	}
	history = append(history, entry)

	updated, err := json.Marshal(history)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, updated)
}

func (c *WalletContract) getWalletHistory(ctx contractapi.TransactionContextInterface,
	prefix, userID string) (string, error) {

	bytes, err := ctx.GetStub().GetState(prefix + userID)
	if err != nil {
		return "", fmt.Errorf("내역 조회 실패: %v", err)
	}
	if bytes == nil {
		return "[]", nil
	}

	var history []WalletTx
	if err := json.Unmarshal(bytes, &history); err != nil {
		return "", err
	}

	// 최신순 정렬
	for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
		history[i], history[j] = history[j], history[i]
	}

	result, err := json.Marshal(history)
	if err != nil {
		return "", err
	}
	return string(result), nil
}

func (c *WalletContract) getEscrowState(ctx contractapi.TransactionContextInterface,
	orderID string) (*EscrowState, error) {

	bytes, err := ctx.GetStub().GetState(escrowPrefix + orderID)
	if err != nil {
		return nil, fmt.Errorf("에스크로 조회 실패: %v", err)
	}
	if bytes == nil {
		return nil, fmt.Errorf("에스크로 정보 없음: %s", orderID)
	}

	var state EscrowState
	if err := json.Unmarshal(bytes, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func parsePositiveInt(s string) (int64, error) {
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil || v <= 0 {
		return 0, fmt.Errorf("양의 정수여야 합니다: %s", s)
	}
	return v, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&WalletContract{})
	if err != nil {
		panic(fmt.Sprintf("지갑 체인코드 초기화 실패: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("지갑 체인코드 시작 실패: %v", err))
	}
}

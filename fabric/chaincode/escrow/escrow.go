// Package main implements the Recode AI escrow chaincode on Hyperledger Fabric.
//
// 에스크로 체인코드: 구매 대금을 락업하고 구매 확정 또는 신고 환불 시 처리
//
// 지원 트랜잭션:
//   - LockEscrow    : 구매 시 RP 락업 (구매자 → 에스크로)
//   - SettleEscrow  : 구매 확정 시 정산 (에스크로 → 판매자)
//   - RefundEscrow  : 신고 환불 시 반환 (에스크로 → 구매자)
//   - GetEscrowState: 에스크로 상태 조회
//   - RecordTrade   : 거래 원장 기록
//   - GetTradeHistory: 거래 원장 조회
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// EscrowContract — 에스크로 스마트 컨트랙트
type EscrowContract struct {
	contractapi.Contract
}

// EscrowState — 에스크로 상태 데이터
type EscrowState struct {
	OrderID   string    `json:"orderId"`
	BuyerID   string    `json:"buyerId"`
	SellerID  string    `json:"sellerId"`
	AmountRP  int64     `json:"amountRp"`
	Status    string    `json:"status"`   // LOCKED | SETTLED | REFUNDED
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// TradeRecord — 거래 원장 기록
type TradeRecord struct {
	OrderID   string    `json:"orderId"`
	ProductID string    `json:"productId"`
	BuyerID   string    `json:"buyerId"`
	SellerID  string    `json:"sellerId"`
	AmountRP  int64     `json:"amountRp"`
	CreatedAt time.Time `json:"createdAt"`
}

const (
	escrowKeyPrefix = "ESCROW:"
	tradeKeyPrefix  = "TRADE:"
)

// LockEscrow — 구매 시 RP 에스크로 락업
func (c *EscrowContract) LockEscrow(ctx contractapi.TransactionContextInterface,
	orderID, buyerID, sellerID, amountRPStr string) (string, error) {

	amountRP, err := strconv.ParseInt(amountRPStr, 10, 64)
	if err != nil || amountRP <= 0 {
		return "", fmt.Errorf("유효하지 않은 RP 금액: %s", amountRPStr)
	}

	key := escrowKeyPrefix + orderID
	existing, _ := ctx.GetStub().GetState(key)
	if existing != nil {
		return "", fmt.Errorf("에스크로가 이미 존재합니다: %s", orderID)
	}

	now := time.Now().UTC()
	state := &EscrowState{
		OrderID:   orderID,
		BuyerID:   buyerID,
		SellerID:  sellerID,
		AmountRP:  amountRP,
		Status:    "LOCKED",
		CreatedAt: now,
		UpdatedAt: now,
	}

	bytes, err := json.Marshal(state)
	if err != nil {
		return "", fmt.Errorf("직렬화 실패: %v", err)
	}

	if err := ctx.GetStub().PutState(key, bytes); err != nil {
		return "", fmt.Errorf("상태 저장 실패: %v", err)
	}

	_ = ctx.GetStub().SetEvent("EscrowLocked", bytes)
	return fmt.Sprintf("에스크로 락업 완료: order=%s amount=%d RP", orderID, amountRP), nil
}

// SettleEscrow — 구매 확정 시 판매자에게 정산
func (c *EscrowContract) SettleEscrow(ctx contractapi.TransactionContextInterface,
	orderID, sellerID, settledAmountStr string) (string, error) {

	state, err := c.getEscrowState(ctx, orderID)
	if err != nil {
		return "", err
	}
	if state.Status != "LOCKED" {
		return "", fmt.Errorf("락업 상태가 아닙니다: %s", state.Status)
	}
	if state.SellerID != sellerID {
		return "", fmt.Errorf("판매자 ID 불일치")
	}

	settledAmount, err := strconv.ParseInt(settledAmountStr, 10, 64)
	if err != nil || settledAmount <= 0 {
		return "", fmt.Errorf("유효하지 않은 정산 금액: %s", settledAmountStr)
	}

	state.Status = "SETTLED"
	state.UpdatedAt = time.Now().UTC()

	bytes, err := json.Marshal(state)
	if err != nil {
		return "", err
	}

	if err := ctx.GetStub().PutState(escrowKeyPrefix+orderID, bytes); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"orderId":       orderID,
		"sellerId":      sellerID,
		"settledAmount": settledAmount,
	})
	_ = ctx.GetStub().SetEvent("EscrowSettled", eventData)

	return fmt.Sprintf("에스크로 정산 완료: order=%s seller=%s amount=%d RP", orderID, sellerID, settledAmount), nil
}

// RefundEscrow — 신고/분쟁으로 구매자에게 환불
func (c *EscrowContract) RefundEscrow(ctx contractapi.TransactionContextInterface,
	orderID, buyerID string) (string, error) {

	state, err := c.getEscrowState(ctx, orderID)
	if err != nil {
		return "", err
	}
	if state.Status != "LOCKED" {
		return "", fmt.Errorf("락업 상태가 아닙니다: %s", state.Status)
	}
	if state.BuyerID != buyerID {
		return "", fmt.Errorf("구매자 ID 불일치")
	}

	state.Status = "REFUNDED"
	state.UpdatedAt = time.Now().UTC()

	bytes, err := json.Marshal(state)
	if err != nil {
		return "", err
	}

	if err := ctx.GetStub().PutState(escrowKeyPrefix+orderID, bytes); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"orderId":  orderID,
		"buyerId":  buyerID,
		"amountRp": state.AmountRP,
	})
	_ = ctx.GetStub().SetEvent("EscrowRefunded", eventData)

	return fmt.Sprintf("에스크로 환불 완료: order=%s buyer=%s amount=%d RP", orderID, buyerID, state.AmountRP), nil
}

// GetEscrowState — 에스크로 상태 조회
func (c *EscrowContract) GetEscrowState(ctx contractapi.TransactionContextInterface,
	orderID string) (*EscrowState, error) {

	return c.getEscrowState(ctx, orderID)
}

// RecordTrade — 거래 원장에 기록 (조회용)
func (c *EscrowContract) RecordTrade(ctx contractapi.TransactionContextInterface,
	orderID, productID, buyerID, sellerID, amountRPStr string) (string, error) {

	amountRP, err := strconv.ParseInt(amountRPStr, 10, 64)
	if err != nil || amountRP <= 0 {
		return "", fmt.Errorf("유효하지 않은 RP 금액: %s", amountRPStr)
	}

	key := tradeKeyPrefix + orderID
	record := &TradeRecord{
		OrderID:   orderID,
		ProductID: productID,
		BuyerID:   buyerID,
		SellerID:  sellerID,
		AmountRP:  amountRP,
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

// GetTradeHistory — 거래 원장 조회 (특정 주문)
func (c *EscrowContract) GetTradeHistory(ctx contractapi.TransactionContextInterface,
	orderID string) (*TradeRecord, error) {

	key := tradeKeyPrefix + orderID
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

func (c *EscrowContract) getEscrowState(ctx contractapi.TransactionContextInterface,
	orderID string) (*EscrowState, error) {

	key := escrowKeyPrefix + orderID
	bytes, err := ctx.GetStub().GetState(key)
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

func main() {
	chaincode, err := contractapi.NewChaincode(&EscrowContract{})
	if err != nil {
		panic(fmt.Sprintf("에스크로 체인코드 초기화 실패: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("에스크로 체인코드 시작 실패: %v", err))
	}
}

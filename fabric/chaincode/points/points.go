// Package main implements the Recode AI RP points ledger chaincode on Hyperledger Fabric.
//
// 포인트 원장 체인코드: RP 발행, 차감, 잔액 조회, 내역 조회
//
// 지원 트랜잭션:
//   - InitLedger   : 원장 초기화
//   - IssuePoints  : RP 발행 (충전/보상)
//   - DeductPoints : RP 차감 (구매/출금)
//   - GetBalance   : RP 잔액 조회
//   - GetHistory   : RP 거래 내역 조회
package main

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// PointsContract — RP 포인트 원장 컨트랙트
type PointsContract struct {
	contractapi.Contract
}

// PointBalance — 사용자 RP 잔액 상태
type PointBalance struct {
	UserID    string    `json:"userId"`
	Balance   int64     `json:"balance"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// PointTransaction — RP 거래 내역 항목
type PointTransaction struct {
	TxID      string    `json:"txId"`
	UserID    string    `json:"userId"`
	Type      string    `json:"type"`   // ISSUE | DEDUCT
	Amount    int64     `json:"amount"`
	Balance   int64     `json:"balance"`
	Memo      string    `json:"memo"`
	Timestamp time.Time `json:"timestamp"`
}

const (
	balanceKeyPrefix = "BALANCE:"
	historyKeyPrefix = "HISTORY:"
)

// InitLedger — 원장 초기화 (배포 시 1회 실행)
func (c *PointsContract) InitLedger(ctx contractapi.TransactionContextInterface) error {
	fmt.Println("Recode AI RP 포인트 원장 초기화 완료")
	return nil
}

// IssuePoints — RP 발행 (충전, 판매 보상, 리뷰 보상 등)
func (c *PointsContract) IssuePoints(ctx contractapi.TransactionContextInterface,
	userID, amountStr, memo string) (string, error) {

	amount, err := strconv.ParseInt(amountStr, 10, 64)
	if err != nil || amount <= 0 {
		return "", fmt.Errorf("유효하지 않은 RP 금액: %s", amountStr)
	}

	balance, err := c.getBalance(ctx, userID)
	if err != nil {
		return "", err
	}

	newBalance := balance + amount

	if err := c.saveBalance(ctx, userID, newBalance); err != nil {
		return "", err
	}

	if err := c.appendHistory(ctx, userID, "ISSUE", amount, newBalance, memo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"userId":  userID,
		"amount":  amount,
		"balance": newBalance,
		"memo":    memo,
	})
	_ = ctx.GetStub().SetEvent("PointsIssued", eventData)

	return fmt.Sprintf("RP 발행 완료: user=%s amount=%d balance=%d", userID, amount, newBalance), nil
}

// DeductPoints — RP 차감 (구매, 출금 등)
func (c *PointsContract) DeductPoints(ctx contractapi.TransactionContextInterface,
	userID, amountStr, memo string) (string, error) {

	amount, err := strconv.ParseInt(amountStr, 10, 64)
	if err != nil || amount <= 0 {
		return "", fmt.Errorf("유효하지 않은 RP 금액: %s", amountStr)
	}

	balance, err := c.getBalance(ctx, userID)
	if err != nil {
		return "", err
	}

	if balance < amount {
		return "", fmt.Errorf("RP 잔액 부족: 보유=%d 필요=%d", balance, amount)
	}

	newBalance := balance - amount

	if err := c.saveBalance(ctx, userID, newBalance); err != nil {
		return "", err
	}

	if err := c.appendHistory(ctx, userID, "DEDUCT", -amount, newBalance, memo, ctx.GetStub().GetTxID()); err != nil {
		return "", err
	}

	eventData, _ := json.Marshal(map[string]interface{}{
		"userId":  userID,
		"amount":  amount,
		"balance": newBalance,
		"memo":    memo,
	})
	_ = ctx.GetStub().SetEvent("PointsDeducted", eventData)

	return fmt.Sprintf("RP 차감 완료: user=%s amount=%d balance=%d", userID, amount, newBalance), nil
}

// GetBalance — RP 잔액 조회
func (c *PointsContract) GetBalance(ctx contractapi.TransactionContextInterface,
	userID string) (string, error) {

	balance, err := c.getBalance(ctx, userID)
	if err != nil {
		return "", err
	}
	return strconv.FormatInt(balance, 10), nil
}

// GetHistory — RP 거래 내역 조회 (전체, 최신순)
func (c *PointsContract) GetHistory(ctx contractapi.TransactionContextInterface,
	userID string) (string, error) {

	key := historyKeyPrefix + userID
	bytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return "", fmt.Errorf("내역 조회 실패: %v", err)
	}
	if bytes == nil {
		return "[]", nil
	}

	var history []PointTransaction
	if err := json.Unmarshal(bytes, &history); err != nil {
		return "", err
	}

	// 최신순 정렬 (배열 역순)
	for i, j := 0, len(history)-1; i < j; i, j = i+1, j-1 {
		history[i], history[j] = history[j], history[i]
	}

	result, err := json.Marshal(history)
	if err != nil {
		return "", err
	}
	return string(result), nil
}

// ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

func (c *PointsContract) getBalance(ctx contractapi.TransactionContextInterface, userID string) (int64, error) {
	key := balanceKeyPrefix + userID
	bytes, err := ctx.GetStub().GetState(key)
	if err != nil {
		return 0, fmt.Errorf("잔액 조회 실패: %v", err)
	}
	if bytes == nil {
		return 0, nil
	}

	var pb PointBalance
	if err := json.Unmarshal(bytes, &pb); err != nil {
		return 0, err
	}
	return pb.Balance, nil
}

func (c *PointsContract) saveBalance(ctx contractapi.TransactionContextInterface, userID string, balance int64) error {
	key := balanceKeyPrefix + userID
	pb := &PointBalance{
		UserID:    userID,
		Balance:   balance,
		UpdatedAt: time.Now().UTC(),
	}
	bytes, err := json.Marshal(pb)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, bytes)
}

func (c *PointsContract) appendHistory(ctx contractapi.TransactionContextInterface,
	userID, txType string, amount, balance int64, memo, txID string) error {

	key := historyKeyPrefix + userID
	bytes, _ := ctx.GetStub().GetState(key)

	var history []PointTransaction
	if bytes != nil {
		_ = json.Unmarshal(bytes, &history)
	}

	entry := PointTransaction{
		TxID:      txID,
		UserID:    userID,
		Type:      txType,
		Amount:    amount,
		Balance:   balance,
		Memo:      memo,
		Timestamp: time.Now().UTC(),
	}
	history = append(history, entry)

	updated, err := json.Marshal(history)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(key, updated)
}

func main() {
	chaincode, err := contractapi.NewChaincode(&PointsContract{})
	if err != nil {
		panic(fmt.Sprintf("포인트 체인코드 초기화 실패: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("포인트 체인코드 시작 실패: %v", err))
	}
}

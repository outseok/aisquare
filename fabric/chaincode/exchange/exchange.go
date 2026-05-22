// exchange.go — AISquare ↔ NaverPay 포인트 전환 원장
// naver-channel에 배포되어 양 조직(AISquare + NaverPay)이 검증 가능.
// 결제 포인트(PAID)만 NaverPay 포인트로 1:1 전환 가능.
package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type ExchangeContract struct {
	contractapi.Contract
}

// PaidBalance — 사용자가 보유한 결제 포인트 잔액
type PaidBalance struct {
	UserID  string `json:"userId"`
	Balance int64  `json:"balance"` // PAID 포인트
}

// ExchangeRecord — 네이버페이 전환 기록
type ExchangeRecord struct {
	ID        string `json:"id"`
	UserID    string `json:"userId"`
	Amount    int64  `json:"amount"`     // 전환된 PAID 포인트
	Direction string `json:"direction"`  // "AISQUARE_TO_NAVER" or "NAVER_TO_AISQUARE"
	NaverTxID string `json:"naverTxId,omitempty"`
	Status    string `json:"status"` // "PENDING","CONFIRMED","REJECTED"
	CreatedAt string `json:"createdAt"`
}

func balanceKey(userID string) string  { return "paid:" + userID }
func recordKey(id string) string       { return "ex:" + id }
func userIndexKey(userID, id string) string { return "uidx:" + userID + ":" + id }

// IssuePaid — AISquare 측에서 PAID 포인트 적립 (충전·구매확정 캐시백)
func (c *ExchangeContract) IssuePaid(ctx contractapi.TransactionContextInterface, userID string, amount int64, memo string) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	bal, _ := c.GetPaidBalance(ctx, userID)
	bal += amount
	pb := PaidBalance{UserID: userID, Balance: bal}
	data, _ := json.Marshal(pb)
	return ctx.GetStub().PutState(balanceKey(userID), data)
}

// DeductPaid — 결제 사용 또는 전환 시 차감
func (c *ExchangeContract) DeductPaid(ctx contractapi.TransactionContextInterface, userID string, amount int64, memo string) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	bal, _ := c.GetPaidBalance(ctx, userID)
	if bal < amount {
		return fmt.Errorf("insufficient PAID balance: have %d, need %d", bal, amount)
	}
	pb := PaidBalance{UserID: userID, Balance: bal - amount}
	data, _ := json.Marshal(pb)
	return ctx.GetStub().PutState(balanceKey(userID), data)
}

// GetPaidBalance — 사용자 PAID 잔액 조회
func (c *ExchangeContract) GetPaidBalance(ctx contractapi.TransactionContextInterface, userID string) (int64, error) {
	data, err := ctx.GetStub().GetState(balanceKey(userID))
	if err != nil {
		return 0, err
	}
	if data == nil {
		return 0, nil
	}
	var pb PaidBalance
	if err := json.Unmarshal(data, &pb); err != nil {
		return 0, err
	}
	return pb.Balance, nil
}

// ExchangeToNaver — PAID 포인트를 네이버페이 포인트로 전환 요청 (잔액 차감 후 PENDING 기록)
func (c *ExchangeContract) ExchangeToNaver(ctx contractapi.TransactionContextInterface, exchangeID, userID string, amount int64) error {
	if amount <= 0 {
		return fmt.Errorf("amount must be positive")
	}
	if err := c.DeductPaid(ctx, userID, amount, "naver-exchange"); err != nil {
		return err
	}
	ts, _ := ctx.GetStub().GetTxTimestamp()
	rec := ExchangeRecord{
		ID:        exchangeID,
		UserID:    userID,
		Amount:    amount,
		Direction: "AISQUARE_TO_NAVER",
		Status:    "PENDING",
		CreatedAt: time.Unix(ts.Seconds, int64(ts.Nanos)).UTC().Format(time.RFC3339),
	}
	data, _ := json.Marshal(rec)
	if err := ctx.GetStub().PutState(recordKey(exchangeID), data); err != nil {
		return err
	}
	return ctx.GetStub().PutState(userIndexKey(userID, exchangeID), []byte("1"))
}

// ConfirmNaverExchange — NaverPay가 자기 시스템에서 포인트 적립 완료한 후 호출 (NaverPayMSP만 가능)
func (c *ExchangeContract) ConfirmNaverExchange(ctx contractapi.TransactionContextInterface, exchangeID, naverTxID string) error {
	mspID, _ := ctx.GetClientIdentity().GetMSPID()
	if mspID != "NaverPayMSP" {
		return fmt.Errorf("only NaverPayMSP can confirm exchange (got %s)", mspID)
	}
	data, err := ctx.GetStub().GetState(recordKey(exchangeID))
	if err != nil || data == nil {
		return fmt.Errorf("exchange not found: %s", exchangeID)
	}
	var rec ExchangeRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return err
	}
	if rec.Status != "PENDING" {
		return fmt.Errorf("exchange not in PENDING state (current: %s)", rec.Status)
	}
	rec.Status = "CONFIRMED"
	rec.NaverTxID = naverTxID
	updated, _ := json.Marshal(rec)
	return ctx.GetStub().PutState(recordKey(exchangeID), updated)
}

// RejectNaverExchange — NaverPay가 거부 시 (예: 한도 초과). PAID 환불.
func (c *ExchangeContract) RejectNaverExchange(ctx contractapi.TransactionContextInterface, exchangeID, reason string) error {
	mspID, _ := ctx.GetClientIdentity().GetMSPID()
	if mspID != "NaverPayMSP" {
		return fmt.Errorf("only NaverPayMSP can reject exchange (got %s)", mspID)
	}
	data, err := ctx.GetStub().GetState(recordKey(exchangeID))
	if err != nil || data == nil {
		return fmt.Errorf("exchange not found: %s", exchangeID)
	}
	var rec ExchangeRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return err
	}
	if rec.Status != "PENDING" {
		return fmt.Errorf("exchange not in PENDING state (current: %s)", rec.Status)
	}
	rec.Status = "REJECTED"
	updated, _ := json.Marshal(rec)
	if err := ctx.GetStub().PutState(recordKey(exchangeID), updated); err != nil {
		return err
	}
	// Refund PAID
	bal, _ := c.GetPaidBalance(ctx, rec.UserID)
	bal += rec.Amount
	pb := PaidBalance{UserID: rec.UserID, Balance: bal}
	pbData, _ := json.Marshal(pb)
	return ctx.GetStub().PutState(balanceKey(rec.UserID), pbData)
}

// GetExchange — 단건 조회
func (c *ExchangeContract) GetExchange(ctx contractapi.TransactionContextInterface, exchangeID string) (*ExchangeRecord, error) {
	data, err := ctx.GetStub().GetState(recordKey(exchangeID))
	if err != nil || data == nil {
		return nil, fmt.Errorf("not found")
	}
	var rec ExchangeRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

// GetUserExchanges — 사용자별 전환 기록 목록
func (c *ExchangeContract) GetUserExchanges(ctx contractapi.TransactionContextInterface, userID string) ([]*ExchangeRecord, error) {
	iter, err := ctx.GetStub().GetStateByRange("uidx:"+userID+":", "uidx:"+userID+":~")
	if err != nil {
		return nil, err
	}
	defer iter.Close()
	out := []*ExchangeRecord{}
	for iter.HasNext() {
		kv, _ := iter.Next()
		// key format: uidx:userID:exchangeID
		exID := kv.Key[len("uidx:"+userID+":"):]
		rec, err := c.GetExchange(ctx, exID)
		if err == nil {
			out = append(out, rec)
		}
	}
	return out, nil
}

func main() {
	cc, err := contractapi.NewChaincode(&ExchangeContract{})
	if err != nil {
		fmt.Printf("Error creating exchange chaincode: %v\n", err)
		return
	}
	if err := cc.Start(); err != nil {
		fmt.Printf("Error starting exchange chaincode: %v\n", err)
	}
}

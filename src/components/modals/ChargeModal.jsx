import { useState } from 'react'
import { CreditCard, Coins } from 'lucide-react'
import Modal from '../common/Modal'
import { squareApi } from '../../api'
import { SQUARE_POLICY, POINT_POLICY } from '../../constants'
import toast from 'react-hot-toast'

const { KRW_PER_SQUARE, MIN_CHARGE, CHARGE_UNIT } = SQUARE_POLICY
const { CHARGE_POINT_RATE } = POINT_POLICY

export default function ChargeModal({ isOpen, onClose, onSuccess, currentBalance }) {
  const [amount, setAmount] = useState('')
  const [charging, setCharging] = useState(false)

  const square = Number(amount) || 0
  const krw = Math.round(square * KRW_PER_SQUARE)
  const pointReward = Math.floor(krw * CHARGE_POINT_RATE)

  const validate = () => {
    if (square < MIN_CHARGE) {
      toast.error(`최소 ${MIN_CHARGE.toLocaleString()} Square 이상 충전 가능합니다.`)
      return false
    }
    if (square % CHARGE_UNIT !== 0) {
      toast.error(`${CHARGE_UNIT.toLocaleString()} Square 단위로 입력해주세요.`)
      return false
    }
    return true
  }

  const handleCharge = async () => {
    if (!validate()) return
    setCharging(true)
    try {
      await squareApi.charge(square)
      toast.success(`${square.toLocaleString()} Square 충전 완료!${pointReward > 0 ? ` (+${pointReward} Point 적립)` : ''}`)
      setAmount('')
      onSuccess?.()
      onClose()
    } catch {
      // api 인터셉터 처리
    } finally {
      setCharging(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Square Wallet 충전" size="sm">
      <div className="space-y-5">
        {currentBalance != null && (
          <div className="flex items-center justify-between bg-surface rounded-xl px-4 py-3">
            <p className="text-sm text-gray-500">현재 잔액</p>
            <p className="text-gray-900 font-semibold">{currentBalance.toLocaleString()} Square</p>
          </div>
        )}

        <div>
          <label className="label">충전할 Square 수량</label>
          <div className="relative">
            <input
              type="number"
              className="input pr-20"
              placeholder={`${MIN_CHARGE.toLocaleString()} 이상, ${CHARGE_UNIT.toLocaleString()} 단위`}
              min={MIN_CHARGE}
              step={CHARGE_UNIT}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
              Square
            </span>
          </div>
        </div>

        <div className="bg-surface rounded-xl divide-y divide-surface-border">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="text-sm text-gray-500">결제 금액</p>
            <p className="text-gray-900 font-semibold">
              {square > 0 ? `₩${krw.toLocaleString()}` : '—'}
            </p>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <Coins size={13} className="text-yellow-400" />
              예상 Point 적립
            </div>
            <p className="text-yellow-400 font-semibold text-sm">
              {square > 0 ? `+${pointReward} Point` : '—'}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-600">
          최소 {MIN_CHARGE.toLocaleString()} Square · {CHARGE_UNIT.toLocaleString()} Square 단위 ·
          1,000 Square = 1,100원
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">취소</button>
          <button
            onClick={handleCharge}
            disabled={charging || !amount}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <CreditCard size={15} />
            {charging ? '결제 중...' : 'Toss로 충전하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

import { useState, useEffect } from 'react'
import {
  Wallet, Coins, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus, Repeat2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { squareApi, pointApi, exchangeApi } from '../../api'
import { POINT_POLICY, EXCHANGE_PARTNERS, EXCHANGE_STATUS_CONFIG } from '../../constants'
import ChargeModal from '../../components/modals/ChargeModal'

const { REVIEW_REWARD, CHARGE_POINT_RATE } = POINT_POLICY

const SQUARE_TYPE_CONFIG = {
  CHARGE: { icon: <ArrowDownLeft size={14} className="text-green-400" />, label: '충전' },
  EARN:   { icon: <ArrowDownLeft size={14} className="text-green-400" />, label: '판매 정산' },
  SPEND:  { icon: <ArrowUpRight  size={14} className="text-red-400"   />, label: '결제' },
}

const POINT_TYPE_CONFIG = {
  CHARGE_REWARD: { icon: <ArrowDownLeft size={14} className="text-yellow-400" />, label: '충전 적립' },
  REVIEW:        { icon: <ArrowDownLeft size={14} className="text-yellow-400" />, label: '리뷰 보상' },
  CASHBACK:      { icon: <ArrowDownLeft size={14} className="text-yellow-400" />, label: '캐시백' },
  SPEND:         { icon: <ArrowUpRight  size={14} className="text-gray-400"   />, label: '결제 사용' },
}

function HistoryItem({ item, typeConfig }) {
  const config = typeConfig[item.type] ?? {
    icon: <ArrowUpRight size={14} className="text-gray-400" />,
    label: item.type,
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface rounded-xl">
      <div className="flex items-center gap-2.5">
        {config.icon}
        <div>
          <p className="text-sm text-gray-900">{item.description ?? config.label}</p>
          <p className="text-xs text-gray-400">
            {new Date(item.createdAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>
      <span className={`font-semibold text-sm ${item.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
        {item.amount > 0 ? '+' : ''}{item.amount.toLocaleString()}
      </span>
    </div>
  )
}

const MOCK_SQUARE_HISTORY = [
  { id: 1, type: 'CHARGE', amount: 50000, description: 'Toss 충전', createdAt: '2025-11-10T09:23:00Z' },
  { id: 2, type: 'SPEND',  amount: -12000, description: 'ChatGPT 족보 마스터팩 구매', createdAt: '2025-11-08T14:05:00Z' },
  { id: 3, type: 'EARN',   amount: 8500, description: 'Claude 프롬프트 세트 판매 정산', createdAt: '2025-11-05T11:30:00Z' },
  { id: 4, type: 'CHARGE', amount: 30000, description: 'Toss 충전', createdAt: '2025-10-28T16:00:00Z' },
  { id: 5, type: 'SPEND',  amount: -6000, description: 'Midjourney 프롬프트 100선 구매', createdAt: '2025-10-20T10:10:00Z' },
]

const MOCK_POINT_HISTORY = [
  { id: 1, type: 'CHARGE_REWARD', amount: 1500, description: '충전 적립 (50,000원)', createdAt: '2025-11-10T09:23:00Z' },
  { id: 2, type: 'REVIEW',        amount: 500,  description: '리뷰 작성 보상', createdAt: '2025-11-09T13:00:00Z' },
  { id: 3, type: 'SPEND',         amount: -2000, description: '결제 포인트 사용', createdAt: '2025-11-08T14:05:00Z' },
  { id: 4, type: 'CASHBACK',      amount: 300,  description: '이벤트 캐시백', createdAt: '2025-10-30T09:00:00Z' },
]

const MOCK_EXCHANGE_HISTORY = [
  { id: 1, partnerId: 'naver', direction: 'IN',  amount: 5000, partnerAmount: 4500, status: 'COMPLETED', createdAt: '2025-11-01T10:00:00Z' },
  { id: 2, partnerId: 'kakao', direction: 'OUT', amount: 3000, partnerAmount: 2700, status: 'PENDING',   createdAt: '2025-11-12T15:30:00Z' },
]

function SquareTab() {
  const [balance, setBalance] = useState(70500)
  const [history, setHistory] = useState(MOCK_SQUARE_HISTORY)
  const [loading, setLoading] = useState(false)
  const [showCharge, setShowCharge] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [balRes, histRes] = await Promise.all([
        squareApi.getBalance(),
        squareApi.getHistory({ limit: 20 }),
      ])
      setBalance(balRes.data.balance)
      setHistory(histRes.data.items ?? [])
    } catch {
      setBalance(70500)
      setHistory(MOCK_SQUARE_HISTORY)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="card animate-pulse h-48" />

  return (
    <div className="space-y-5">
      {/* 잔액 카드 */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Square 잔액</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-gray-900">{balance.toLocaleString()}</p>
              <p className="text-xl text-gray-500 pb-0.5">Square</p>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              ≈ ₩{balance.toLocaleString()} (결제 기준)
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2.5 btn-secondary" title="새로고침">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setShowCharge(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 btn-primary text-sm"
            >
              <Plus size={15} />
              충전
            </button>
          </div>
        </div>
      </div>

      {/* 안내 */}
      <div className="bg-surface rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1">
        <p>• 결제 시: 1 Square = 1원</p>
        <p>• 충전 시: 1,000 Square = 1,100원 (수수료 10% 포함)</p>
        <p>• 충전 금액의 {(CHARGE_POINT_RATE * 100).toFixed(1)}% → Point Wallet 자동 적립</p>
      </div>

      {/* 내역 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">거래 내역</h3>
        {history.length === 0 ? (
          <p className="text-center text-gray-600 py-8">내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <HistoryItem key={item.id} item={item} typeConfig={SQUARE_TYPE_CONFIG} />
            ))}
          </div>
        )}
      </div>

      <ChargeModal
        isOpen={showCharge}
        onClose={() => setShowCharge(false)}
        onSuccess={load}
        currentBalance={balance}
      />
    </div>
  )
}

function PointTab() {
  const [balance, setBalance] = useState(2300)
  const [history, setHistory] = useState(MOCK_POINT_HISTORY)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [balRes, histRes] = await Promise.all([
        pointApi.getBalance(),
        pointApi.getHistory({ limit: 20 }),
      ])
      setBalance(balRes.data.balance)
      setHistory(histRes.data.items ?? [])
    } catch {
      setBalance(2300)
      setHistory(MOCK_POINT_HISTORY)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="card animate-pulse h-48" />

  return (
    <div className="space-y-5">
      {/* 잔액 카드 */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Point 잔액</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-gray-900">{balance.toLocaleString()}</p>
              <p className="text-xl text-gray-500 pb-0.5">Point</p>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              ≈ ₩{balance.toLocaleString()} 결제 할인 가능
            </p>
          </div>
          <button onClick={load} className="p-2.5 btn-secondary" title="새로고침">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* 적립 방법 안내 */}
      <div className="card">
        <p className="text-sm font-semibold text-gray-700 mb-3">Point 적립 방법</p>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span>리뷰 작성</span>
            <span className="text-yellow-400 font-semibold">+{REVIEW_REWARD} Point</span>
          </div>
          <div className="flex items-center justify-between">
            <span>구매 확정 캐시백</span>
            <span className="text-yellow-400 font-semibold">결제 금액의 2%</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Square 충전 적립</span>
            <span className="text-yellow-400 font-semibold">충전 금액의 0.1%</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-surface-border">
          Point는 출금 불가 · 결제 시 할인 전용 · 1 Point = 1원 할인
        </p>
      </div>

      {/* 내역 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-3">적립 내역</h3>
        {history.length === 0 ? (
          <p className="text-center text-gray-600 py-8">내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <HistoryItem key={item.id} item={item} typeConfig={POINT_TYPE_CONFIG} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ExchangeHistoryItem({ item }) {
  const p = EXCHANGE_PARTNERS.find((x) => x.id === item.partnerId)
  const cfg = EXCHANGE_STATUS_CONFIG[item.status] ?? { label: item.status, className: 'bg-gray-500/10 text-gray-400' }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-surface rounded-xl">
      <div className="flex items-center gap-2.5">
        {p && (
          <div className={`w-7 h-7 rounded-lg ${p.bg} ${p.text} flex items-center justify-center font-bold text-xs shrink-0`}>
            {p.short}
          </div>
        )}
        <div>
          <p className="text-sm text-gray-900">
            {item.direction === 'in'
              ? `${p?.name ?? item.partnerId} → AI Square`
              : `AI Square → ${p?.name ?? item.partnerId}`}
          </p>
          <p className="text-xs text-gray-600">
            {new Date(item.createdAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </div>
      <div className="text-right space-y-1">
        <p className="text-sm text-gray-900 font-semibold">
          {(item.fromAmount ?? item.amount ?? 0).toLocaleString()} → {(item.toAmount ?? item.partnerAmount ?? 0).toLocaleString()}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.className}`}>
          {cfg.label}
        </span>
      </div>
    </div>
  )
}

function ExchangeTab() {
  const [partnerId, setPartnerId] = useState(null)
  const [direction, setDirection] = useState('in')
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState(MOCK_EXCHANGE_HISTORY)
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const res = await exchangeApi.getHistory()
      setHistory(res.data.items ?? [])
    } catch {
      setHistory(MOCK_EXCHANGE_HISTORY)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => { loadHistory() }, [])

  const partner = EXCHANGE_PARTNERS.find((p) => p.id === partnerId)
  const rate = partner ? (direction === 'in' ? partner.rateIn : partner.rateOut) : null
  const numAmount = parseInt(amount.replace(/,/g, ''), 10) || 0
  const resultAmount = rate ? Math.floor(numAmount * rate) : 0

  const handleAmountChange = (e) => {
    const v = e.target.value.replace(/[^0-9]/g, '')
    setAmount(v ? parseInt(v, 10).toLocaleString() : '')
  }

  const handleSubmit = async () => {
    if (!partnerId || !numAmount) return
    setSubmitting(true)
    try {
      await exchangeApi.request({ partnerId, direction, amount: numAmount })
      toast.success('전환 요청이 접수되었습니다. Fabric 네트워크에서 처리 중입니다.')
      setAmount('')
      loadHistory()
    } catch {
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* 파트너 선택 */}
      <div>
        <p className="text-sm text-gray-600 mb-3">파트너 선택</p>
        <div className="grid grid-cols-2 gap-2">
          {EXCHANGE_PARTNERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPartnerId(p.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                partnerId === p.id
                  ? 'border-primary bg-primary/10'
                  : 'border-surface-border bg-surface hover:border-gray-500'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${p.bg} ${p.text} flex items-center justify-center font-bold text-sm shrink-0`}>
                {p.short}
              </div>
              <span className="text-sm text-gray-900 font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 방향 선택 */}
      <div>
        <p className="text-sm text-gray-600 mb-3">전환 방향</p>
        <div className="flex gap-1 bg-surface border border-surface-border rounded-xl p-1">
          <button
            onClick={() => setDirection('in')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              direction === 'in' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            포인트 가져오기
          </button>
          <button
            onClick={() => setDirection('out')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              direction === 'out' ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            포인트 내보내기
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {direction === 'in'
            ? `${partner?.name ?? '파트너'} 포인트 → AI Square Point`
            : `AI Square Point → ${partner?.name ?? '파트너'} 포인트`}
        </p>
      </div>

      {/* 수량 입력 */}
      <div>
        <p className="text-sm text-gray-600 mb-2">전환할 포인트 수량</p>
        <input
          type="text"
          className="input w-full"
          placeholder="0"
          value={amount}
          onChange={handleAmountChange}
        />
      </div>

      {/* 전환 미리보기 */}
      {partner && numAmount > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">전환율</span>
            <span className="text-gray-700">1 : {rate}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">수령 포인트</span>
            <span className="text-gray-900 font-semibold">
              {resultAmount.toLocaleString()}
              {direction === 'in' ? ' AI Square Point' : ` ${partner.name} 포인트`}
            </span>
          </div>
          <div className="pt-3 border-t border-surface-border flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
            <p className="text-xs text-gray-500">
              AI Square와 {partner.name} 양 기관이 Hyperledger Fabric 네트워크에서
              서명을 완료한 후 처리됩니다. 통상 1–3분 소요됩니다.
            </p>
          </div>
        </div>
      )}

      {/* 전환 요청 버튼 */}
      <button
        onClick={handleSubmit}
        disabled={!partnerId || !numAmount || submitting}
        className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? '처리 중...' : '전환 요청'}
      </button>

      {/* 전환 내역 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3">전환 내역</h3>
        {loadingHistory ? (
          <div className="animate-pulse h-16 bg-surface rounded-xl" />
        ) : history.length === 0 ? (
          <p className="text-center text-gray-600 py-8">전환 내역이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <ExchangeHistoryItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function WalletManager() {
  const [activeWallet, setActiveWallet] = useState('square')

  const TABS = [
    { id: 'square',   label: 'Square',  icon: Wallet,   activeClass: 'bg-primary text-white'     },
    { id: 'point',    label: 'Point',   icon: Coins,    activeClass: 'bg-yellow-500 text-white'  },
    { id: 'exchange', label: '외부 연동', icon: Repeat2,  activeClass: 'bg-primary text-white'     },
  ]

  return (
    <div className="space-y-5">
      {/* 지갑 탭 */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-2xl p-1">
        {TABS.map(({ id, label, icon: Icon, activeClass }) => (
          <button
            key={id}
            onClick={() => setActiveWallet(id)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium flex-1 justify-center transition-colors ${
              activeWallet === id ? activeClass : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeWallet === 'square'   && <SquareTab />}
      {activeWallet === 'point'    && <PointTab />}
      {activeWallet === 'exchange' && <ExchangeTab />}
    </div>
  )
}

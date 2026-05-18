import { useState, useEffect } from 'react'
import {
  Wallet, Coins, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus,
} from 'lucide-react'
import { squareApi, pointApi } from '../../api'
import { POINT_POLICY } from '../../constants'
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
          <p className="text-sm text-white">{item.description ?? config.label}</p>
          <p className="text-xs text-gray-600">
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

function SquareTab() {
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
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
      // api 인터셉터 처리
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="card animate-pulse h-48" />

  return (
    <div className="space-y-5">
      {/* 잔액 카드 */}
      <div className="card bg-gradient-to-br from-primary/20 to-surface-card border-primary/30">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Square 잔액</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-white">{balance.toLocaleString()}</p>
              <p className="text-xl text-gray-400 pb-0.5">Square</p>
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
        <h3 className="text-sm font-semibold text-gray-400 mb-3">거래 내역</h3>
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
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

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
      // api 인터셉터 처리
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="card animate-pulse h-48" />

  return (
    <div className="space-y-5">
      {/* 잔액 카드 */}
      <div className="card bg-gradient-to-br from-yellow-500/10 to-surface-card border-yellow-500/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Point 잔액</p>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold text-white">{balance.toLocaleString()}</p>
              <p className="text-xl text-gray-400 pb-0.5">Point</p>
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
        <p className="text-sm font-semibold text-gray-300 mb-3">Point 적립 방법</p>
        <div className="space-y-2 text-sm text-gray-400">
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
        <h3 className="text-sm font-semibold text-gray-400 mb-3">적립 내역</h3>
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

export default function WalletManager() {
  const [activeWallet, setActiveWallet] = useState('square')

  return (
    <div className="space-y-5">
      {/* 지갑 탭 */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-2xl p-1">
        <button
          onClick={() => setActiveWallet('square')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium flex-1 justify-center transition-colors ${
            activeWallet === 'square' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Wallet size={15} />
          Square Wallet
        </button>
        <button
          onClick={() => setActiveWallet('point')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium flex-1 justify-center transition-colors ${
            activeWallet === 'point' ? 'bg-yellow-500 text-white' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Coins size={15} />
          Point Wallet
        </button>
      </div>

      {activeWallet === 'square' ? <SquareTab /> : <PointTab />}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Wallet, ShoppingBag, Store, ShieldCheck, ShieldOff, User, Edit3, Check, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePass } from '../../hooks/usePass'
import { useAuthStore } from '../../store/authStore'
import { userApi } from '../../api'
import PurchaseHistory from './PurchaseHistory'
import SalesHistory from './SalesHistory'
import WalletManager from './WalletManager'
import TokenBadge from '../../components/common/TokenBadge'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'account',   label: '계정 정보', icon: User },
  { id: 'wallet',    label: '지갑 관리', icon: Wallet },
  { id: 'purchases', label: '구매 내역', icon: ShoppingBag },
  { id: 'sales',     label: '판매 내역', icon: Store },
]

function EditableField({ label, value, onSave, inputType = 'text' }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  const handleSave = async () => {
    await onSave(draft)
    setEditing(false)
  }
  const handleCancel = () => { setDraft(value ?? ''); setEditing(false) }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-300">{value || '—'}</p>
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-gray-600 hover:text-gray-400 transition-colors"
          >
            <Edit3 size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type={inputType}
          className="input flex-1 py-1.5 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <button onClick={handleCancel} className="p-1.5 rounded text-gray-500 hover:text-white transition-colors">
          <X size={15} />
        </button>
        <button onClick={handleSave} className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors">
          <Check size={15} />
        </button>
      </div>
    </div>
  )
}

function maskPhone(phone) {
  if (!phone) return '—'
  return phone.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3')
}

function AccountTab() {
  const { user } = useAuth()
  const updateUser = useAuthStore((s) => s.updateUser)
  const { isPassVerified, passName, passPhone, passVerifiedAt, initiatePass, mockPassAuth, revokePass } = usePass()
  const [tokenPct, setTokenPct] = useState(null)
  const isDev = import.meta.env.DEV

  useEffect(() => {
    userApi.getMe().then((res) => setTokenPct(res.data.tokenPct)).catch(() => {})
  }, [])

  const saveField = async (field, value) => {
    try {
      await userApi.updateProfile({ [field]: value })
      updateUser({ [field]: value })
      toast.success('저장되었습니다.')
    } catch {}
  }

  return (
    <div className="space-y-4">
      {/* 계정 정보 */}
      <div className="card">
        <h3 className="font-semibold text-white mb-4">계정 정보</h3>
        <div className="space-y-4">
          <EditableField
            label="닉네임"
            value={user?.nickname}
            onSave={(v) => saveField('nickname', v)}
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">아이디</p>
            <p className="text-sm text-gray-400">{user?.username}</p>
          </div>
          <EditableField
            label="이메일"
            value={user?.email}
            onSave={(v) => saveField('email', v)}
            inputType="email"
          />
          {tokenPct != null && (
            <div className="pt-3 border-t border-surface-border">
              <TokenBadge pct={tokenPct} />
            </div>
          )}
        </div>
      </div>

      {/* PASS 본인인증 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isPassVerified
              ? <ShieldCheck size={20} className="text-green-400" />
              : <ShieldOff size={20} className="text-gray-500" />}
            <h3 className="font-semibold text-white">PASS 본인인증</h3>
          </div>
          <span className={`badge ${isPassVerified ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
            {isPassVerified ? '인증 완료' : '미인증'}
          </span>
        </div>

        {isPassVerified ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">인증 이름</p>
              <p className="text-white font-semibold">{passName}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">인증 전화번호</p>
              <p className="text-sm text-gray-300 font-mono">{maskPhone(passPhone)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">인증일시</p>
              <p className="text-sm text-gray-400">
                {passVerifiedAt ? new Date(passVerifiedAt).toLocaleDateString('ko-KR') : '—'}
              </p>
            </div>
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-gray-600 mb-2">
                인증 해제 시 구매·판매·리뷰 기능이 차단됩니다.
              </p>
              <button
                onClick={revokePass}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                인증 해제
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              구매·판매·리뷰·지갑 이용 시 KT · SKT · LG U+ 본인인증이 필요합니다.
            </p>
            <button
              onClick={isDev ? mockPassAuth : initiatePass}
              className="btn-primary w-full"
            >
              {isDev ? 'PASS 인증 (개발 모드)' : 'PASS 인증 시작'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MyPage() {
  const [activeTab, setActiveTab] = useState('account')

  const renderContent = () => {
    switch (activeTab) {
      case 'account':   return <AccountTab />
      case 'wallet':    return <WalletManager />
      case 'purchases': return <PurchaseHistory />
      case 'sales':     return <SalesHistory />
      default:          return null
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">마이페이지</h1>

      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-2xl p-1 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-1 justify-center ${
              activeTab === id
                ? 'bg-primary text-white'
                : 'text-gray-400 hover:text-white hover:bg-surface'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {renderContent()}
    </div>
  )
}

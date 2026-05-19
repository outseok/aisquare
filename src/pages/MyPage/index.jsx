import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet, ShoppingBag, Store, ShieldCheck, ShieldOff, User, Edit3, Check, X, Heart, ShoppingCart } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePass } from '../../hooks/usePass'
import { useAuthStore } from '../../store/authStore'
import { userApi } from '../../api'
import PurchaseHistory from './PurchaseHistory'
import SalesHistory from './SalesHistory'
import WalletManager from './WalletManager'
import Wishlist from './Wishlist'
import Cart from './Cart'
import TokenBadge from '../../components/common/TokenBadge'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'account',   label: '계정 정보', icon: User },
  { id: 'wallet',    label: '지갑 관리', icon: Wallet },
  { id: 'purchases', label: '구매 내역', icon: ShoppingBag },
  { id: 'sales',     label: '판매 내역', icon: Store },
  { id: 'wishlist',  label: '찜 목록',   icon: Heart },
  { id: 'cart',      label: '장바구니',  icon: ShoppingCart },
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
          <p className="text-sm text-gray-700">{value || '—'}</p>
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 transition-colors"
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
        <button onClick={handleCancel} className="p-1.5 rounded text-gray-400 hover:text-gray-700 transition-colors">
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
        <h3 className="font-semibold text-gray-900 mb-4">계정 정보</h3>
        <div className="space-y-4">
          <EditableField
            label="닉네임"
            value={user?.nickname}
            onSave={(v) => saveField('nickname', v)}
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">아이디</p>
            <p className="text-sm text-gray-700">{user?.username}</p>
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
            <h3 className="font-semibold text-gray-900">PASS 본인인증</h3>
          </div>
          <span className={`badge ${isPassVerified ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
            {isPassVerified ? '인증 완료' : '미인증'}
          </span>
        </div>

        {isPassVerified ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">인증 이름</p>
              <p className="text-gray-900 font-semibold">{passName}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">인증 전화번호</p>
              <p className="text-sm text-gray-700 font-mono">{maskPhone(passPhone)}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">인증일시</p>
              <p className="text-sm text-gray-600">
                {passVerifiedAt ? new Date(passVerifiedAt).toLocaleDateString('ko-KR') : '—'}
              </p>
            </div>
            <div className="pt-2 border-t border-surface-border">
              <p className="text-xs text-gray-400 mb-2">
                인증 해제 시 구매·판매·리뷰 기능이 차단됩니다.
              </p>
              <button
                onClick={revokePass}
                className="text-sm text-red-500 hover:text-red-600 transition-colors"
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

const VALID_TABS = ['account', 'wallet', 'purchases', 'sales', 'wishlist', 'cart']

export default function MyPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    VALID_TABS.includes(tabParam) ? tabParam : 'account'
  )

  useEffect(() => {
    if (tabParam && VALID_TABS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams(tab === 'account' ? {} : { tab })
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'account':   return <AccountTab />
      case 'wallet':    return <WalletManager />
      case 'purchases': return <PurchaseHistory />
      case 'sales':     return <SalesHistory />
      case 'wishlist':  return <Wishlist />
      case 'cart':      return <Cart />
      default:          return null
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden flex min-h-[680px]">
        {/* 사이드바 */}
        <aside className="w-48 shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-5 py-5 border-b border-surface-border flex items-center justify-center">
            <h1 className="text-xl font-bold text-gray-900">마이페이지</h1>
          </div>
          <div className="flex flex-col py-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-3 px-6 py-4 text-base font-medium transition-colors w-full text-left ${
                activeTab === id
                  ? 'text-primary bg-primary/8 border-r-2 border-primary'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-surface'
              }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          </div>
        </aside>

        {/* 콘텐츠 */}
        <div className="flex-1 min-w-0 p-6">

          {renderContent()}
        </div>
      </div>
    </div>
  )
}

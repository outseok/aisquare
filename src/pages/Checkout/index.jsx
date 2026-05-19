import { useState, useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { CreditCard, Wallet, Coins, ArrowLeft, Shield, CheckCircle, AlertCircle } from 'lucide-react'
import { squareApi, pointApi, orderApi } from '../../api'
import { usePass } from '../../hooks/usePass'
import AuthRequiredModal from '../../components/modals/AuthRequiredModal'
import toast from 'react-hot-toast'

export default function Checkout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isPassVerified } = usePass()

  const items = location.state?.items ?? []

  const [paymentMethod, setPaymentMethod] = useState('TOSS')
  const [squareBalance, setSquareBalance] = useState(70500)
  const [pointBalance, setPointBalance] = useState(2300)
  const [usedPoint, setUsedPoint] = useState('')
  const [processing, setProcessing] = useState(false)
  const [authModal, setAuthModal] = useState(false)

  const totalKrw = items.reduce((sum, i) => sum + (i.priceKrw ?? 0), 0)
  const maxPoint = Math.min(pointBalance, totalKrw)
  const numUsedPoint = Math.min(parseInt(usedPoint) || 0, maxPoint)
  const finalAmount = Math.max(totalKrw - numUsedPoint, 0)
  const squareShort = paymentMethod === 'SQUARE' && squareBalance < finalAmount

  useEffect(() => {
    Promise.all([squareApi.getBalance(), pointApi.getBalance()])
      .then(([sq, pt]) => {
        setSquareBalance(sq.data.balance)
        setPointBalance(pt.data.balance)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isPassVerified) setAuthModal(true)
  }, [isPassVerified])

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-5 py-24 text-center">
        <AlertCircle size={40} className="mx-auto text-gray-200 mb-4" />
        <p className="text-gray-500 mb-2">결제할 상품이 없습니다.</p>
        <Link to="/" className="text-sm text-primary hover:underline">마켓으로 이동</Link>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!isPassVerified) { setAuthModal(true); return }
    if (squareShort) { toast.error('Square Wallet 잔액이 부족합니다.'); return }
    setProcessing(true)
    try {
      await orderApi.checkout({
        productIds: items.map((i) => i.productId),
        paymentMethod,
        usedPoint: numUsedPoint,
      })
      toast.success('결제 완료! 에스크로에 보관됩니다.')
      navigate('/mypage')
    } catch {
    } finally {
      setProcessing(false)
    }
  }

  const PaymentOption = ({ value, icon, label, sub, warn }) => (
    <button
      onClick={() => setPaymentMethod(value)}
      className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
        paymentMethod === value
          ? 'border-primary bg-primary/5'
          : 'border-surface-border hover:border-gray-300 bg-white'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
        paymentMethod === value ? 'border-primary' : 'border-gray-300'
      }`}>
        {paymentMethod === value && <div className="w-2 h-2 rounded-full bg-primary" />}
      </div>
      {icon}
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
      </div>
      {warn && <span className="text-xs text-red-500 font-medium shrink-0">{warn}</span>}
    </button>
  )

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-4xl mx-auto px-5 py-7">
        {/* 뒤로가기 */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-7 transition-colors"
        >
          <ArrowLeft size={14} />
          돌아가기
        </button>

        <h1 className="text-xl font-bold text-gray-900 mb-7">결제</h1>

        <div className="grid md:grid-cols-[1fr_320px] gap-7 items-start">

          {/* 왼쪽 */}
          <div className="space-y-5">
            {/* 주문 상품 */}
            <div className="border border-surface-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-surface-border bg-surface">
                <h2 className="text-sm font-semibold text-gray-700">주문 상품 <span className="text-gray-400 font-normal">{items.length}개</span></h2>
              </div>
              <div className="divide-y divide-surface-border">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-5 py-4">
                    <div className="w-12 h-12 rounded-lg bg-surface border border-surface-border flex items-center justify-center shrink-0 overflow-hidden">
                      {item.thumbnail
                        ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xl">📄</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.productTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.sellerName}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">
                      ₩{item.priceKrw?.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 결제 수단 */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">결제 수단</h2>
              <div className="space-y-2">
                <PaymentOption
                  value="TOSS"
                  icon={<CreditCard size={16} className="text-gray-400 shrink-0" />}
                  label="Toss Payments"
                  sub="카드 · 계좌이체"
                />
                <PaymentOption
                  value="SQUARE"
                  icon={<Wallet size={16} className="text-gray-400 shrink-0" />}
                  label="Square Wallet"
                  sub={`잔액 ${squareBalance.toLocaleString()} Square`}
                  warn={paymentMethod === 'SQUARE' && squareShort ? '잔액 부족' : null}
                />
              </div>
            </div>

            {/* 에스크로 안내 */}
            <div className="flex items-start gap-2.5 bg-surface border border-surface-border rounded-xl px-4 py-3.5">
              <Shield size={14} className="text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-0.5">Fabric 에스크로 보호</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  결제 대금은 Hyperledger Fabric 체인코드에 보관됩니다. 72시간 내 구매 확정 또는 신고 가능하며, 미확정 시 판매자에게 자동 정산됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* 오른쪽 패널 */}
          <div className="space-y-4">
            {/* 포인트 할인 */}
            <div className="border border-surface-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                  <Coins size={13} className="text-yellow-500" />
                  포인트 사용
                </h2>
                <span className="text-xs text-gray-400">보유 {pointBalance.toLocaleString()}P</span>
              </div>
              <input
                type="number"
                className="input text-sm"
                placeholder={`0 ~ ${maxPoint.toLocaleString()}`}
                min={0}
                max={maxPoint}
                value={usedPoint}
                onChange={(e) => setUsedPoint(e.target.value)}
              />
              {numUsedPoint > 0 && (
                <p className="text-xs text-yellow-600 mt-2 font-medium">
                  −₩{numUsedPoint.toLocaleString()} 할인 적용
                </p>
              )}
            </div>

            {/* 결제 금액 요약 */}
            <div className="border border-surface-border rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">결제 금액</h2>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">상품 금액</span>
                <span className="text-gray-900">₩{totalKrw.toLocaleString()}</span>
              </div>
              {numUsedPoint > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">포인트 할인</span>
                  <span className="text-yellow-600 font-medium">−₩{numUsedPoint.toLocaleString()}</span>
                </div>
              )}
              <div className="pt-3 border-t border-surface-border flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-900">최종 금액</span>
                <span className="text-2xl font-bold text-primary">₩{finalAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* 결제 버튼 */}
            <button
              onClick={handleSubmit}
              disabled={processing || squareShort}
              className="btn-primary w-full py-3.5 text-[15px] flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  처리 중...
                </span>
              ) : (
                <>
                  <CheckCircle size={16} />
                  {paymentMethod === 'TOSS' ? 'Toss로 결제하기' : 'Square로 결제하기'}
                </>
              )}
            </button>

            <p className="text-xs text-center text-gray-400 leading-relaxed">
              결제 즉시 에스크로 보관 · 72시간 후 자동 정산
            </p>
          </div>
        </div>
      </div>

      <AuthRequiredModal
        isOpen={authModal}
        onClose={() => { setAuthModal(false); navigate(-1) }}
        action="purchase"
      />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Download, CheckCircle, AlertTriangle, PenSquare } from 'lucide-react'
import { orderApi } from '../../api'
import { ORDER_STATUS, ORDER_STATUS_LABEL } from '../../constants'
import ReportModal from '../../components/modals/ReportModal'
import ReviewModal from '../../components/modals/ReviewModal'
import AuthRequiredModal from '../../components/modals/AuthRequiredModal'
import { usePass } from '../../hooks/usePass'
import toast from 'react-hot-toast'

const STATUS_STYLE = {
  [ORDER_STATUS.PENDING]: 'bg-yellow-500/10 text-yellow-400',
  [ORDER_STATUS.CONFIRMED]: 'bg-green-500/10 text-green-400',
  [ORDER_STATUS.REPORTED]: 'bg-red-500/10 text-red-400',
  [ORDER_STATUS.REFUNDED]: 'bg-gray-500/10 text-gray-400',
}

function CountdownTimer({ deadline }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline) - new Date()
      if (diff <= 0) { setRemaining('자동 확정됨'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(`${h}시간 ${m}분 후 자동 확정`)
    }
    calc()
    const id = setInterval(calc, 60000)
    return () => clearInterval(id)
  }, [deadline])

  return <span className="text-xs text-gray-500">{remaining}</span>
}

export default function PurchaseHistory() {
  const { isPassVerified } = usePass()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportTarget, setReportTarget] = useState(null)
  const [reviewTarget, setReviewTarget] = useState(null)
  const [authAction, setAuthAction] = useState(null)

  const loadOrders = async () => {
    setLoading(true)
    try {
      const { data } = await orderApi.getList()
      setOrders(data)
    } catch {
      // 인터셉터 처리
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  const requireAuth = (action, fn) => {
    if (!isPassVerified) {
      setAuthAction(action)
      return
    }
    fn()
  }

  const handleDownload = async (orderId) => {
    try {
      const { data } = await orderApi.getDownloadUrl(orderId)
      window.open(data.url, '_blank')
    } catch {}
  }

  const handleConfirm = async (orderId) => {
    requireAuth('purchase', async () => {
      try {
        await orderApi.confirm(orderId)
        toast.success('구매가 확정되었습니다. 판매자에게 수익이 지급됩니다.')
        loadOrders()
      } catch {}
    })
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse h-28" />
        ))}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="card text-center py-16">
        <p className="text-gray-500 text-lg mb-1">구매 내역이 없습니다</p>
        <p className="text-gray-600 text-sm">마켓에서 원하는 족보를 구매해보세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* 상품 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`badge ${STATUS_STYLE[order.status]}`}
                >
                  {ORDER_STATUS_LABEL[order.status]}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('ko-KR')}
                </span>
                {order.status === ORDER_STATUS.PENDING && order.autoConfirmAt && (
                  <CountdownTimer deadline={order.autoConfirmAt} />
                )}
              </div>
              <p className="text-white font-semibold truncate">{order.productTitle}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {order.paymentMethod === 'RP'
                  ? `${order.rpAmount} RP`
                  : `${order.price} ETH`}
                <span className="mx-2">·</span>
                판매자: {order.sellerName}
              </p>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2 flex-wrap shrink-0">
              {/* 다운로드 */}
              <button
                onClick={() => handleDownload(order.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface text-sm text-gray-300 hover:text-white hover:bg-surface-border transition-colors"
              >
                <Download size={14} />
                다운로드
              </button>

              {/* 구매 확정 (PENDING 상태에서만) */}
              {order.status === ORDER_STATUS.PENDING && (
                <button
                  onClick={() => handleConfirm(order.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-sm text-white transition-colors"
                >
                  <CheckCircle size={14} />
                  구매 확정
                </button>
              )}

              {/* 리뷰 작성 (확정 후 && 미작성) */}
              {order.status === ORDER_STATUS.CONFIRMED && !order.hasReview && (
                <button
                  onClick={() =>
                    requireAuth('review', () => setReviewTarget(order))
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary-dark text-sm text-white transition-colors"
                >
                  <PenSquare size={14} />
                  리뷰 작성
                </button>
              )}

              {/* 신고 (PENDING 상태에서만) */}
              {order.status === ORDER_STATUS.PENDING && (
                <button
                  onClick={() =>
                    requireAuth('report', () => setReportTarget(order))
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-600 text-sm text-red-400 hover:bg-red-600 hover:text-white transition-colors"
                >
                  <AlertTriangle size={14} />
                  신고
                </button>
              )}

            </div>
          </div>
        </div>
      ))}

      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        order={reportTarget}
      />

      <ReviewModal
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        order={reviewTarget}
        onSuccess={loadOrders}
      />

      <AuthRequiredModal
        isOpen={!!authAction}
        onClose={() => setAuthAction(null)}
        action={authAction}
      />
    </div>
  )
}

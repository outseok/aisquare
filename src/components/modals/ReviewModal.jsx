import { useState } from 'react'
import { Star } from 'lucide-react'
import Modal from '../common/Modal'
import { reviewApi } from '../../api'
import toast from 'react-hot-toast'

function StarRating({ value, onChange, readonly = false }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className="disabled:cursor-default"
        >
          <Star
            size={28}
            className={`transition-colors ${
              star <= (hover || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export default function ReviewModal({ isOpen, onClose, order, onSuccess }) {
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) { toast.error('별점을 선택해주세요.'); return }
    if (content.trim().length < 10) {
      toast.error('리뷰 내용을 10자 이상 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      await reviewApi.create(order.id, { rating, content })
      toast.success('리뷰가 등록되었습니다. 100 Point가 적립되었습니다!')
      onSuccess?.()
      onClose()
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="리뷰 작성" size="md">
      <div className="space-y-5">
        <div>
          <p className="text-sm text-gray-400">
            상품: <span className="text-white font-medium">{order?.productTitle}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            리뷰 작성 시 <span className="text-yellow-400 font-medium">100 Point</span>가 Point Wallet에 적립됩니다.
            상품당 1회만 작성 가능합니다.
          </p>
        </div>

        {/* 별점 */}
        <div>
          <label className="label">별점 *</label>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} />
            {rating > 0 && (
              <span className="text-sm text-gray-400">
                {['', '매우 나쁨', '나쁨', '보통', '좋음', '매우 좋음'][rating]}
              </span>
            )}
          </div>
        </div>

        {/* 리뷰 내용 */}
        <div>
          <label className="label">리뷰 내용 *</label>
          <textarea
            className="input resize-none"
            rows={5}
            placeholder="상품에 대한 솔직한 리뷰를 작성해주세요. (최소 10자)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
          />
          <p className="text-xs text-gray-500 text-right mt-1">{content.length}/1000</p>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? '등록 중...' : '리뷰 등록'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export { StarRating }

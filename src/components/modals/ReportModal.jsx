import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { ImagePlus, X } from 'lucide-react'
import Modal from '../common/Modal'
import { reportApi } from '../../api'
import toast from 'react-hot-toast'

const REPORT_REASONS = [
  '사기 / 허위 상품',
  '저작권 침해',
  '악성 파일 포함 의심',
  '성인 / 불법 콘텐츠',
  '기타',
]

export default function ReportModal({ isOpen, onClose, order }) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)

  const onDrop = useCallback((accepted) => {
    const newImages = accepted.map((f) => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages((prev) => [...prev, ...newImages].slice(0, 3))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 3,
  })

  const removeImage = (idx) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSubmit = async () => {
    if (!reason) { toast.error('신고 사유를 선택해주세요.'); return }
    if (!detail.trim()) { toast.error('상세 내용을 입력해주세요.'); return }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('orderId', order.id)
      formData.append('reason', reason)
      formData.append('detail', detail)
      images.forEach(({ file }) => formData.append('images', file))

      await reportApi.create(formData)
      toast.success('신고가 접수되었습니다. 관리자가 검토 후 연락드립니다.')
      onClose()
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="상품 신고" size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-sm text-gray-400 mb-1">
            상품: <span className="text-white">{order?.productTitle}</span>
          </p>
          <p className="text-xs text-gray-500">
            신고 접수 즉시 정산이 보류되고 관리자가 슬랙으로 알림을 받습니다.
          </p>
        </div>

        {/* 신고 사유 */}
        <div>
          <label className="label">신고 사유 *</label>
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  reason === r
                    ? 'bg-primary border-primary text-white'
                    : 'border-surface-border text-gray-400 hover:border-primary'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* 상세 내용 */}
        <div>
          <label className="label">상세 내용 *</label>
          <textarea
            className="input resize-none"
            rows={4}
            placeholder="신고 사유를 자세히 입력해주세요."
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-gray-500 text-right mt-1">{detail.length}/500</p>
        </div>

        {/* 이미지 첨부 */}
        <div>
          <label className="label">증거 이미지 (최대 3장)</label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-surface-border hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <ImagePlus size={24} className="mx-auto text-gray-500 mb-1" />
            <p className="text-sm text-gray-500">이미지를 드래그하거나 클릭하여 업로드</p>
            <p className="text-xs text-gray-600">PNG, JPG (최대 5MB, 최대 3장)</p>
          </div>

          {images.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map(({ preview }, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={preview}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg border border-surface-border"
                  />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-danger flex-1"
          >
            {loading ? '신고 접수 중...' : '신고 접수'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

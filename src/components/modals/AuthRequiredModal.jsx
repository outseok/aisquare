import { ShieldCheck } from 'lucide-react'
import Modal from '../common/Modal'
import { usePass } from '../../hooks/usePass'

const ACTION_LABEL = {
  purchase: '상품 구매',
  sell: '상품 등록',
  review: '리뷰 작성',
  report: '신고 접수',
}

export default function AuthRequiredModal({ isOpen, onClose, action = 'purchase' }) {
  const { isPassVerified, initiatePass, mockPassAuth } = usePass()
  const isDev = import.meta.env.DEV

  const handleAuth = async () => {
    onClose()
    if (isDev) {
      await mockPassAuth()
    } else {
      await initiatePass()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="본인인증 필요">
      <div className="flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <ShieldCheck size={32} className="text-primary" />
        </div>

        <div>
          <p className="text-gray-300 mb-1">
            <span className="text-white font-semibold">{ACTION_LABEL[action]}</span>를 위해
            본인인증이 필요합니다.
          </p>
          <p className="text-sm text-gray-500">
            PASS 앱을 통한 휴대폰 본인인증을 진행합니다.
            인증은 1회만 필요하며, 이후 자동으로 유지됩니다.
          </p>
        </div>

        <div className="w-full bg-surface rounded-xl p-4 text-left text-sm text-gray-400 space-y-1.5">
          <p className="font-medium text-gray-300 mb-2">인증 흐름</p>
          <p>① [PASS 인증 시작] 버튼 클릭</p>
          <p>② 팝업에서 통신사 선택 (KT / SKT / LG U+)</p>
          <p>③ PASS 앱 또는 문자로 인증 완료</p>
          <p>④ 자동으로 인증 상태 저장</p>
        </div>

        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="btn-secondary flex-1">
            취소
          </button>
          <button onClick={handleAuth} className="btn-primary flex-1">
            {isDev ? '인증 (개발 모드)' : 'PASS 인증 시작'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

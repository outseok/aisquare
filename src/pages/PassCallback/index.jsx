import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react'

export default function PassCallback() {
  const [params] = useSearchParams()
  const code = params.get('code')
  const [status, setStatus] = useState('pending') // pending | sent | no-opener

  useEffect(() => {
    if (!window.opener) {
      setStatus('no-opener')
      return
    }
    window.opener.postMessage(
      { type: 'PASS_CALLBACK', code: code ?? null },
      window.location.origin
    )
    setStatus('sent')
    window.close()
  }, [code])

  if (status === 'no-opener') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <ShieldOff size={48} className="text-gray-500 mx-auto mb-4" />
          <p className="text-white font-semibold">잘못된 접근입니다.</p>
          <p className="text-sm text-gray-500 mt-1">
            이 페이지는 PASS 인증 팝업에서만 접근 가능합니다.
          </p>
        </div>
      </div>
    )
  }

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <ShieldOff size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-white font-semibold">인증이 취소되었습니다.</p>
          <p className="text-sm text-gray-500 mt-1">창이 자동으로 닫힙니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <ShieldCheck size={48} className="text-green-400 mx-auto mb-4" />
        <p className="text-white font-semibold">인증 완료</p>
        <p className="text-sm text-gray-500 mt-1 flex items-center justify-center gap-1.5">
          <Loader2 size={13} className="animate-spin" />
          창이 자동으로 닫힙니다.
        </p>
      </div>
    </div>
  )
}

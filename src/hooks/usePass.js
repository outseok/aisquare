import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { passApi } from '../api'

export function usePass() {
  const { isPassVerified, passName, passPhone, passVerifiedAt, setPassVerified, clearPass } = useAuthStore()
  const popupRef = useRef(null)
  const listenerRef = useRef(null)

  const initiatePass = useCallback(async () => {
    // 이전 리스너가 남아있으면 정리
    if (listenerRef.current) {
      window.removeEventListener('message', listenerRef.current)
      listenerRef.current = null
    }

    const toastId = toast.loading('PASS 인증을 시작합니다...')
    try {
      const { sessionId, passUrl } = await passApi.init().then((r) => r.data)

      const popup = window.open(
        passUrl,
        'PASS_AUTH',
        'width=480,height=700,left=200,top=100,resizable=no,scrollbars=yes'
      )

      if (!popup) {
        toast.dismiss(toastId)
        toast.error('팝업이 차단되었습니다. 브라우저 팝업 허용 후 다시 시도해주세요.')
        return
      }

      popupRef.current = popup
      toast.dismiss(toastId)
      toast('PASS 인증 팝업이 열렸습니다.', { icon: '📱' })

      const handler = async (event) => {
        if (event.origin !== window.location.origin) return
        if (event.data?.type !== 'PASS_CALLBACK') return

        window.removeEventListener('message', handler)
        listenerRef.current = null
        popupRef.current?.close()

        if (!event.data.code) {
          toast.error('인증이 취소되었습니다.')
          return
        }

        const loadingId = toast.loading('인증 확인 중...')
        try {
          const { passName, passPhone } = await passApi
            .verify(event.data.code, sessionId)
            .then((r) => r.data)

          setPassVerified({ passName, passPhone })
          toast.dismiss(loadingId)
          toast.success(`${passName}님, PASS 인증이 완료되었습니다.`)
        } catch {
          toast.dismiss(loadingId)
          toast.error('인증 확인에 실패했습니다. 다시 시도해주세요.')
        }
      }

      listenerRef.current = handler
      window.addEventListener('message', handler)
    } catch {
      toast.dismiss(toastId)
      toast.error('PASS 인증을 시작할 수 없습니다.')
    }
  }, [setPassVerified])

  const mockPassAuth = useCallback(async () => {
    const toastId = toast.loading('PASS 인증 중...')
    await new Promise((r) => setTimeout(r, 1500))
    setPassVerified({ passName: '최유리', passPhone: '010-1234-5678' })
    toast.dismiss(toastId)
    toast.success('PASS 본인인증이 완료되었습니다.')
  }, [setPassVerified])

  const revokePass = useCallback(() => {
    clearPass()
    toast('PASS 인증이 해제되었습니다.')
  }, [clearPass])

  return {
    isPassVerified,
    passName,
    passPhone,
    passVerifiedAt,
    initiatePass,
    mockPassAuth,
    revokePass,
  }
}

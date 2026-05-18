import { useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api'
import toast from 'react-hot-toast'

export function useAuth() {
  const { isLoggedIn, user, setUser, logout: storeLogout } = useAuthStore()

  const login = useCallback(async ({ username, password }) => {
    const { data } = await authApi.login({ username, password })
    setUser(data.user)
    toast.success(`${data.user.nickname}님, 환영합니다!`)
  }, [setUser])

  const register = useCallback(async (formData) => {
    const { data } = await authApi.register(formData)
    setUser(data.user)
    toast.success('회원가입이 완료되었습니다!')
  }, [setUser])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    storeLogout()
    toast('로그아웃되었습니다.')
  }, [storeLogout])

  const mockLogin = useCallback(() => {
    setUser({
      id: 'dev-1',
      username: 'yuridev',
      name: '최유리',
      nickname: '유리',
      email: 'yuri@dev.com',
    })
    toast.success('개발 로그인 완료')
  }, [setUser])

  return { isLoggedIn, user, login, register, logout, mockLogin }
}

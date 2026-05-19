import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { authApi } from '../../api'
import toast from 'react-hot-toast'

const ADMIN_ID = 'admin'
const ADMIN_PW = 'admin1234'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { setUser } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.login({ username, password })
      const user = res.data?.user ?? res.data
      if (user?.role !== 'ADMIN') {
        toast.error('관리자 계정이 아닙니다.')
        return
      }
      setUser(user)
      navigate('/admin')
    } catch {
      // API 없는 개발 환경: 하드코딩 계정으로 폴백
      if (username === ADMIN_ID && password === ADMIN_PW) {
        setUser({ id: 0, username: 'admin', nickname: '관리자', role: 'ADMIN' })
        toast.success('관리자로 로그인되었습니다.')
        navigate('/admin')
      } else {
        toast.error('아이디 또는 비밀번호가 올바르지 않습니다.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center px-5 bg-surface">
      <div className="w-full max-w-sm">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={24} className="text-primary" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">관리자 로그인</h1>
          <p className="text-sm text-gray-400 mt-1">AI Square 관리자 전용 페이지입니다.</p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="bg-white border border-surface-border rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">아이디</label>
            <input
              type="text"
              className="input w-full"
              placeholder="관리자 아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">비밀번호</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                className="input w-full pr-10"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 mt-2 disabled:opacity-50"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-4">
          개발 환경: ID <span className="font-mono font-semibold">admin</span> / PW <span className="font-mono font-semibold">admin1234</span>
        </p>
      </div>
    </div>
  )
}

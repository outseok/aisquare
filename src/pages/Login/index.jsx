import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function Login() {
  const { isLoggedIn, login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  if (isLoggedIn) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login({ username, password })
      navigate('/')
    } catch {
      // api 인터셉터 처리
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            <span className="text-primary">AI</span> Square
          </h1>
          <p className="text-gray-500 text-sm mt-1">AI 족보 마켓플레이스</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">아이디</label>
              <input
                className="input"
                placeholder="아이디 입력"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="label">비밀번호</label>
              <input
                type="password"
                className="input"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            계정이 없으신가요?{' '}
            <Link to="/register" className="text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

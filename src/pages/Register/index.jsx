import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Register() {
  const { isLoggedIn, register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    username: '',
    nickname: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })
  const [loading, setLoading] = useState(false)

  if (isLoggedIn) return <Navigate to="/" replace />

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.passwordConfirm) {
      toast.error('비밀번호가 일치하지 않습니다.')
      return
    }
    if (form.password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    setLoading(true)
    try {
      await register({
        name: form.name,
        username: form.username,
        nickname: form.nickname,
        email: form.email,
        password: form.password,
      })
      navigate('/')
    } catch {
      // api 인터셉터 처리
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            <span className="text-primary">Recode</span> AI
          </h1>
          <p className="text-gray-500 text-sm mt-1">AI 족보 마켓플레이스</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-white mb-5">회원가입</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">이름</label>
              <input
                className="input"
                placeholder="실명"
                value={form.name}
                onChange={set('name')}
                required
              />
            </div>
            <div>
              <label className="label">아이디</label>
              <input
                className="input"
                placeholder="영문·숫자 조합 (4자 이상)"
                value={form.username}
                onChange={set('username')}
                minLength={4}
                pattern="[a-zA-Z0-9]+"
                title="영문, 숫자만 사용 가능합니다"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <label className="label">닉네임</label>
              <input
                className="input"
                placeholder="서비스에서 사용할 이름"
                value={form.nickname}
                onChange={set('nickname')}
                required
              />
            </div>
            <div>
              <label className="label">이메일</label>
              <input
                type="email"
                className="input"
                placeholder="example@email.com"
                value={form.email}
                onChange={set('email')}
                required
              />
            </div>
            <div>
              <label className="label">비밀번호</label>
              <input
                type="password"
                className="input"
                placeholder="8자 이상"
                value={form.password}
                onChange={set('password')}
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <label className="label">비밀번호 확인</label>
              <input
                type="password"
                className="input"
                placeholder="비밀번호 재입력"
                value={form.passwordConfirm}
                onChange={set('passwordConfirm')}
                autoComplete="new-password"
                required
              />
            </div>

            <p className="text-xs text-gray-600">
              구매·판매 시 PASS 본인인증이 추가로 필요합니다.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

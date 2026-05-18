import { Suspense, lazy, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ShoppingBag, Store, Wallet, Menu, X, ShieldCheck, LogOut } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { usePass } from './hooks/usePass'
import PrivateRoute from './components/common/PrivateRoute'

const MyPage          = lazy(() => import('./pages/MyPage'))
const ProductRegister = lazy(() => import('./pages/ProductRegister'))
const SellerPage      = lazy(() => import('./pages/SellerPage'))
const Login           = lazy(() => import('./pages/Login'))
const Register        = lazy(() => import('./pages/Register'))
const PassCallback    = lazy(() => import('./pages/PassCallback'))

function GNB() {
  const { isLoggedIn, user, logout, mockLogin } = useAuth()
  const { isPassVerified } = usePass()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV

  const handleLogout = async () => {
    await logout()
    navigate('/')
    setMobileOpen(false)
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-surface-border bg-surface/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-primary">Recode</span>
          <span>AI</span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-card transition-colors"
          >
            <ShoppingBag size={15} />
            구매 마켓
          </Link>
          {isLoggedIn && (
            <Link
              to="/sell"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-card transition-colors"
            >
              <Store size={15} />
              판매 등록
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <span className="text-xs text-gray-500 bg-surface-card border border-surface-border px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                {isPassVerified && <ShieldCheck size={12} className="text-green-400" />}
                {user?.nickname}
              </span>
              <Link
                to="/mypage"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-surface-card transition-colors"
              >
                <Wallet size={15} />
                마이페이지
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-surface-card transition-colors"
              >
                <LogOut size={15} />
                로그아웃
              </button>
            </>
          ) : (
            <>
              {isDev && (
                <button
                  onClick={mockLogin}
                  className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-white transition-colors"
                >
                  개발 로그인
                </button>
              )}
              <Link to="/login" className="btn-secondary text-sm px-4 py-2">
                로그인
              </Link>
              <Link to="/register" className="btn-primary text-sm px-4 py-2">
                회원가입
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 text-gray-400"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-surface-border bg-surface-card px-4 py-3 space-y-2">
          <Link to="/" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-300">구매 마켓</Link>
          {isLoggedIn ? (
            <>
              <Link to="/sell" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-300">판매 등록</Link>
              <Link to="/mypage" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-300">마이페이지</Link>
              <button onClick={handleLogout} className="block w-full text-left py-2 text-sm text-red-400">로그아웃</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-gray-300">로그인</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="block py-2 text-sm text-primary">회원가입</Link>
              {isDev && (
                <button
                  onClick={() => { mockLogin(); setMobileOpen(false) }}
                  className="block w-full text-left py-2 text-sm text-gray-500"
                >
                  개발 로그인
                </button>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const PlaceholderPage = ({ title }) => (
  <div className="max-w-3xl mx-auto px-4 py-20 text-center">
    <p className="text-2xl font-bold text-white mb-2">{title}</p>
    <p className="text-gray-500">장우혁 담당 페이지입니다.</p>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#2a2a3e', color: '#fff', border: '1px solid #3a3a52' },
        }}
      />
      <GNB />
      <main className="min-h-screen">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                    element={<PlaceholderPage title="마켓 메인 (장우혁)" />} />
            <Route path="/products/:id"        element={<PlaceholderPage title="상품 상세 (장우혁)" />} />
            <Route path="/seller/:address"     element={<SellerPage />} />
            <Route path="/login"               element={<Login />} />
            <Route path="/register"            element={<Register />} />
            <Route path="/mypage"              element={<PrivateRoute><MyPage /></PrivateRoute>} />
            <Route path="/sell"                element={<PrivateRoute><ProductRegister /></PrivateRoute>} />
            <Route path="/auth/pass/callback"  element={<PassCallback />} />
          </Routes>
        </Suspense>
      </main>
    </BrowserRouter>
  )
}

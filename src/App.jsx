import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Menu, X, ShieldCheck, Heart, ShoppingCart } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { usePass } from './hooks/usePass'
import { useCartWishlistStore } from './store/cartWishlistStore'
import PrivateRoute from './components/common/PrivateRoute'
import AdminRoute from './components/common/AdminRoute'

const Home             = lazy(() => import('./pages/Home'))
const Market           = lazy(() => import('./pages/Market'))
const ProductDetail    = lazy(() => import('./pages/ProductDetail'))
const Checkout         = lazy(() => import('./pages/Checkout'))
const MyPage           = lazy(() => import('./pages/MyPage'))
const ProductRegister  = lazy(() => import('./pages/ProductRegister'))
const SellerPage       = lazy(() => import('./pages/SellerPage'))
const CreatorsRanking  = lazy(() => import('./pages/CreatorsRanking'))
const MonthlyRanking   = lazy(() => import('./pages/MonthlyRanking'))
const Login            = lazy(() => import('./pages/Login'))
const Register         = lazy(() => import('./pages/Register'))
const PassCallback     = lazy(() => import('./pages/PassCallback'))
const Admin            = lazy(() => import('./pages/Admin'))
const AdminLogin       = lazy(() => import('./pages/AdminLogin'))

function IconBtn({ to, icon: Icon, count, label }) {
  return (
    <Link
      to={to}
      className="relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-surface transition-colors"
      title={label}
    >
      <Icon size={20} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}

function GNB() {
  const { isLoggedIn, user, logout } = useAuth()
  const { isPassVerified } = usePass()
  const { cartCount, wishlistCount, fetchCounts, resetCounts } = useCartWishlistStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const isDev = import.meta.env.DEV

  useEffect(() => {
    if (isLoggedIn) fetchCounts()
    else resetCounts()
  }, [isLoggedIn])

  const handleLogout = async () => {
    await logout()
    resetCounts()
    navigate('/')
    setMobileOpen(false)
  }

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-surface-border">
      <div className="max-w-6xl mx-auto px-5 h-[60px] flex items-center justify-between gap-4">

        {/* 로고 */}
        <Link to="/" className="flex items-center gap-1.5 shrink-0">
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
            <span className="text-white text-[10px] font-black">AI</span>
          </div>
          <span className="text-[15px] font-bold text-gray-900 tracking-tight">Square</span>
        </Link>

        {/* 중앙 메뉴 */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          <Link to="/market" className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-surface rounded-md transition-colors font-medium">마켓</Link>
          <Link to="/creators" className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-surface rounded-md transition-colors font-medium">크리에이터</Link>
          {isLoggedIn && (
            <Link to="/sell" className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-surface rounded-md transition-colors font-medium">판매하기</Link>
          )}
        </div>

        {/* 우측 액션 */}
        <div className="hidden md:flex items-center gap-1.5">
          {isLoggedIn ? (
            <>
              {isPassVerified && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-medium mr-1">
                  <ShieldCheck size={11} />
                  인증됨
                </span>
              )}

              {/* 관리자 */}
              {user?.role === 'ADMIN' && (
                <Link to="/admin" className="text-xs text-primary bg-primary/8 hover:bg-primary/15 px-2.5 py-1 rounded-md font-semibold transition-colors mr-0.5">
                  관리자
                </Link>
              )}

              {/* 찜 */}
              <IconBtn to="/mypage?tab=wishlist" icon={Heart} count={wishlistCount} label="찜 목록" />
              {/* 장바구니 */}
              <IconBtn to="/mypage?tab=cart" icon={ShoppingCart} count={cartCount} label="장바구니" />

              {/* 프로필 */}
              <Link
                to="/mypage"
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-surface transition-colors font-medium ml-1"
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                  {user?.nickname?.[0] ?? 'U'}
                </div>
                {user?.nickname}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-md hover:bg-surface transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              {isDev && (
                <Link to="/admin/login" className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded transition-colors mr-1">
                  관리자
                </Link>
              )}
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-md hover:bg-surface transition-colors font-medium">
                로그인
              </Link>
              <Link to="/register" className="btn-primary text-sm px-4 py-1.5">
                회원가입
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2 text-gray-500 -mr-1" onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-border bg-white px-5 py-3 space-y-0.5">
          <Link to="/market" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-gray-700 font-medium">마켓</Link>
          <Link to="/creators" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-gray-700 font-medium">크리에이터</Link>
          {isLoggedIn ? (
            <>
              <Link to="/sell" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-gray-700 font-medium">판매하기</Link>
              <Link to="/mypage?tab=wishlist" onClick={() => setMobileOpen(false)} className="flex items-center justify-between h-10 text-sm text-gray-700 font-medium">
                <span>찜 목록</span>
                {wishlistCount > 0 && <span className="text-xs text-primary font-bold">{wishlistCount}</span>}
              </Link>
              <Link to="/mypage?tab=cart" onClick={() => setMobileOpen(false)} className="flex items-center justify-between h-10 text-sm text-gray-700 font-medium">
                <span>장바구니</span>
                {cartCount > 0 && <span className="text-xs text-primary font-bold">{cartCount}</span>}
              </Link>
              <Link to="/mypage" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-gray-700 font-medium">마이페이지</Link>
              {user?.role === 'ADMIN' && (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-primary font-semibold">관리자 페이지</Link>
              )}
              <button onClick={handleLogout} className="flex items-center h-10 w-full text-left text-sm text-red-500 font-medium">로그아웃</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-gray-700 font-medium">로그인</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-primary font-semibold">회원가입</Link>
              {isDev && (
                <Link to="/admin/login" onClick={() => setMobileOpen(false)} className="flex items-center h-10 text-sm text-gray-400">관리자</Link>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  )
}

function Footer() {
  return (
    <footer className="bg-white border-t border-surface-border">
      <div className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex flex-col md:flex-row gap-10">
          <div className="md:w-64 shrink-0">
            <Link to="/" className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center">
                <span className="text-white text-[10px] font-black">AI</span>
              </div>
              <span className="text-[15px] font-bold text-gray-900 tracking-tight">Square</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-4">
              AI 노하우 · 족보 · 강의자료를<br />
              안전하게 사고 파는 마켓플레이스
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Hyperledger Fabric 에스크로 기반<br />
              72시간 구매 확정 · 안전 거래 보장
            </p>
            <div className="flex gap-3 mt-5 text-xs text-gray-400">
              <a href="#" className="hover:text-gray-700 transition-colors">이용약관</a>
              <span>·</span>
              <a href="#" className="hover:text-gray-700 font-semibold transition-colors">개인정보처리방침</a>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <p className="text-sm font-bold text-gray-800 mb-3">서비스</p>
              <ul className="space-y-2">
                <li><Link to="/market" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">마켓</Link></li>
                <li><Link to="/creators" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">이달의 크리에이터</Link></li>
                <li><Link to="/sell" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">판매 시작하기</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 mb-3">크리에이터</p>
              <ul className="space-y-2">
                <li><Link to="/sell" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">상품 등록</Link></li>
                <li><Link to="/creators" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">순위 보기</Link></li>
                <li><Link to="/mypage?tab=sales" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">내 판매 현황</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800 mb-3">고객 지원</p>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">공지사항</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">자주 묻는 질문</a></li>
                <li><a href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">에스크로 안내</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-surface-border">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            AI Square 졸업프로젝트팀 · 부산대학교 정보컴퓨터공학부 · 지도교수 홍길동
          </p>
          <p className="text-xs text-gray-400">© 2025 AI Square. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #efefef',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            fontSize: '14px',
            borderRadius: '10px',
          },
        }}
      />
      <GNB />
      <main className="min-h-screen bg-surface">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                   element={<Home />} />
            <Route path="/market"             element={<Market />} />
            <Route path="/products/:id"       element={<ProductDetail />} />
            <Route path="/checkout"           element={<PrivateRoute><Checkout /></PrivateRoute>} />
            <Route path="/seller/:id"         element={<SellerPage />} />
            <Route path="/creators"           element={<CreatorsRanking />} />
            <Route path="/creators/monthly"   element={<MonthlyRanking />} />
            <Route path="/login"              element={<Login />} />
            <Route path="/register"           element={<Register />} />
            <Route path="/mypage"             element={<PrivateRoute><MyPage /></PrivateRoute>} />
            <Route path="/sell"               element={<PrivateRoute><ProductRegister /></PrivateRoute>} />
            <Route path="/auth/pass/callback" element={<PassCallback />} />
            <Route path="/admin/login"        element={<AdminLogin />} />
            <Route path="/admin"              element={<AdminRoute><Admin /></AdminRoute>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </BrowserRouter>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Star, ArrowRight,
  Shield, Zap, ShoppingBag, Heart, ShoppingCart,
} from 'lucide-react'
import { productApi, wishlistApi, cartApi } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

// ── 목 데이터 ──────────────────────────────────────────────────────────────

const TOP_CREATORS = [
  { rank: 1, name: '김민준', specialty: 'ChatGPT 프롬프트', rating: 4.9, sales: 134, badge: '1st', sellerAddress: 'addr1', bio: 'ChatGPT 프롬프트 엔지니어링 전문가. 3년간 AI 노하우를 공유하고 있습니다.' },
  { rank: 2, name: '이서연', specialty: 'Claude 자동화',    rating: 4.8, sales: 98,  badge: '2nd', sellerAddress: 'addr2', bio: 'Claude API 기반 업무 자동화 전문. 논문·보고서 요약 프롬프트 다수 보유.' },
  { rank: 3, name: '박도윤', specialty: '수능 족보',        rating: 4.7, sales: 87,  badge: '3rd', sellerAddress: 'addr3', bio: 'AI로 정리한 수능·공무원 시험 족보 전문 제작자.' },
]

const MOCK_PRODUCTS = [
  { id: 1,  category: '족보',       title: 'ChatGPT 활용 수능 영어 지문 분석 족보 마스터팩',           sellerName: '김민준', sellerAddress: 'addr1',  priceKrw: 12000, avgRating: 4.8, reviewCount: 134, thumbnailUrl: 'https://picsum.photos/seed/ai1/400/300' },
  { id: 2,  category: 'AI 프롬프트', title: 'Claude 3.5 논문 요약 자동화 프롬프트 세트 (20장)',          sellerName: '이서연', sellerAddress: 'addr2',  priceKrw: 8500,  avgRating: 4.6, reviewCount: 87,  thumbnailUrl: 'https://picsum.photos/seed/ai2/400/300' },
  { id: 3,  category: '족보',       title: '공무원 한국사 AI 정리 족보 2025 최신판',                     sellerName: '박도윤', sellerAddress: 'addr3',  priceKrw: 15000, avgRating: 4.9, reviewCount: 212, thumbnailUrl: 'https://picsum.photos/seed/ai3/400/300' },
  { id: 4,  category: 'AI 프롬프트', title: '스타트업 IR 덱 작성 GPT 프롬프트 + 활용 예시',              sellerName: '최유리', sellerAddress: 'addr4',  priceKrw: 29000, avgRating: 5.0, reviewCount: 43,  thumbnailUrl: 'https://picsum.photos/seed/ai4/400/300' },
  { id: 5,  category: '강의자료',   title: 'AI 도구 완전 정복 강의자료 — 비전공자를 위한 ChatGPT 입문',  sellerName: '정하은', sellerAddress: 'addr5',  priceKrw: 6000,  avgRating: 4.3, reviewCount: 56,  thumbnailUrl: 'https://picsum.photos/seed/ai5/400/300' },
  { id: 6,  category: '족보',       title: '경영학 전공 기말 족보 AI 분석팩 — 핵심 요약 + 예상문제',    sellerName: '한지호', sellerAddress: 'addr6',  priceKrw: 19000, avgRating: 4.7, reviewCount: 98,  thumbnailUrl: 'https://picsum.photos/seed/ai6/400/300' },
  { id: 7,  category: '강의자료',   title: '대학원 연구계획서 작성 가이드 + Claude 프롬프트 템플릿',    sellerName: '오세진', sellerAddress: 'addr7',  priceKrw: 11000, avgRating: 4.5, reviewCount: 31,  thumbnailUrl: 'https://picsum.photos/seed/ai7/400/300' },
  { id: 8,  category: '노하우',     title: 'GPT-4o 업무 생산성 극대화 노하우 — 직장인 실전 가이드',    sellerName: '윤다인', sellerAddress: 'addr8',  priceKrw: 7500,  avgRating: 4.4, reviewCount: 72,  thumbnailUrl: 'https://picsum.photos/seed/ai8/400/300' },
]

// ── 배너 슬라이드 ────────────────────────────────────────────────────────────

function SlideIntro() {
  return (
    <div className="h-full bg-white relative overflow-hidden flex items-center border border-surface-border">
      {/* 배경 데코 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-primary/5" />
        <div className="absolute -bottom-16 left-1/3 w-64 h-64 rounded-full bg-primary/4" />
        <div className="absolute top-1/2 right-1/4 w-36 h-36 rounded-full bg-primary/3" />
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-8 flex items-center justify-between gap-10">
        {/* 텍스트 */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 bg-primary/8 text-primary text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 border border-primary/15">
            <Shield size={11} />
            Hyperledger Fabric 에스크로 보호
          </div>
          <h2 className="text-[42px] font-extrabold leading-[1.15] mb-5 tracking-tight text-gray-900">
            AI 노하우를<br />사고 팔아보세요
          </h2>
          <p className="text-gray-500 text-[15px] mb-8 leading-relaxed">
            프롬프트 · 족보 · 강의자료를 안전하게 거래하세요.<br />
            검증된 크리에이터의 지식이 기다립니다.
          </p>
          <div className="flex gap-3">
            <Link to="/market" className="btn-primary px-6 py-3 text-sm font-bold">
              마켓 둘러보기
            </Link>
            <Link to="/sell" className="px-6 py-3 rounded-lg text-sm font-semibold border border-surface-border text-gray-700 hover:bg-surface hover:border-gray-300 transition-colors">
              판매 시작하기
            </Link>
          </div>
        </div>

        {/* 플로팅 카드 데코 */}
        <div className="hidden lg:block relative shrink-0 w-72 h-52">
          <div className="absolute top-0 right-0 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.10)] p-4 w-52 border border-surface-border">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">김</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">ChatGPT 영어 프롬프트</p>
                <p className="text-[10px] text-gray-400">김민준</p>
              </div>
            </div>
            <div className="flex items-center justify-between bg-surface rounded-lg px-2.5 py-2">
              <span className="text-xs font-bold text-gray-900">₩12,000</span>
              <div className="flex items-center gap-0.5">
                <Star size={9} className="text-yellow-400 fill-yellow-400" />
                <span className="text-[10px] text-gray-600 font-semibold">4.8</span>
                <span className="text-[10px] text-gray-400">(134)</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 bg-primary rounded-2xl p-4 w-44 shadow-lg shadow-primary/25">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={12} className="text-white shrink-0" />
              <p className="text-white text-xs font-semibold">에스크로 보호</p>
            </div>
            <p className="text-white/65 text-[10px] leading-relaxed">Fabric 체인코드<br />72시간 구매 확정</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SlideCreators() {
  return (
    <div className="h-full bg-white relative overflow-hidden flex items-center border border-surface-border">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/4" />
        <div className="absolute bottom-0 left-1/4 w-56 h-56 rounded-full bg-primary/3" />
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-8 flex flex-col items-center justify-center text-center pb-6">
        <p className="text-primary text-[11px] font-bold tracking-[0.15em] uppercase mb-2">이달의 크리에이터</p>
        <h2 className="text-[28px] font-extrabold text-gray-900 mb-1">인기 크리에이터 TOP 3</h2>
        <p className="text-gray-400 text-sm mb-4">별점과 거래량으로 선정한 이달의 베스트 셀러</p>

        <div className="flex items-end gap-3 justify-center mb-4">
          {TOP_CREATORS.map((c, i) => {
            const medal = ['🥇','🥈','🥉'][i]
            const isFirst = i === 0
            return (
              <Link
                key={c.rank}
                to={`/seller/${c.sellerAddress}`}
                className={`relative bg-white border rounded-2xl text-center hover:shadow-md hover:-translate-y-0.5 transition-all ${
                  isFirst
                    ? 'border-primary/25 shadow-[0_4px_20px_rgba(21,87,255,0.12)] px-7 py-4 w-36'
                    : 'border-surface-border shadow-sm px-5 py-3 w-28'
                }`}
              >
                <span className="text-lg leading-none block mb-1.5">{medal}</span>
                <div className={`rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold mx-auto mb-1.5 ${
                  isFirst ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm'
                }`}>
                  {c.name[0]}
                </div>
                <p className={`font-bold text-gray-900 ${isFirst ? 'text-sm' : 'text-xs'}`}>{c.name}</p>
                <p className="text-primary text-[10px] font-medium truncate mb-1.5">{c.specialty}</p>
                <div className="flex items-center justify-center gap-0.5 mb-0.5">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={9} className={s <= Math.round(c.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                  ))}
                </div>
                <p className="text-gray-700 text-[11px] font-bold">{c.rating}</p>
              </Link>
            )
          })}
        </div>

        <Link
          to="/creators/monthly"
          className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-6 py-2.5 rounded-xl"
        >
          이달의 크리에이터 보기
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

function SlideMarket() {
  return (
    <div className="h-full bg-white relative overflow-hidden flex items-center border border-surface-border">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full bg-primary/4" />
        <div className="absolute -top-24 -left-16 w-64 h-64 rounded-full bg-primary/3" />
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-8 flex items-center justify-between gap-12">
        <div>
          <p className="text-primary text-sm font-semibold mb-3 tracking-wide">1,200+ 개의 AI 노하우 상품</p>
          <h2 className="text-[42px] font-extrabold leading-tight tracking-tight mb-6 text-gray-900">
            지금 바로<br />AI 마켓을 탐색하세요
          </h2>
          <Link
            to="/market"
            className="inline-flex items-center gap-2 btn-primary px-7 py-3.5 text-[15px] font-bold"
          >
            마켓 보러가기
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="hidden lg:flex gap-3 shrink-0">
          {[
            { icon: <Shield size={22} />, label: '에스크로 보호', sub: 'Fabric 기반' },
            { icon: <Zap size={22} />, label: '즉시 거래', sub: '72시간 확정' },
            { icon: <ShoppingBag size={22} />, label: '다양한 상품', sub: '1,200+ 등록' },
          ].map((item) => (
            <div key={item.label} className="bg-surface border border-surface-border rounded-2xl p-5 text-center w-[110px]">
              <div className="text-primary mb-3 flex justify-center">{item.icon}</div>
              <p className="text-gray-800 text-xs font-semibold leading-tight">{item.label}</p>
              <p className="text-gray-400 text-[10px] mt-1">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 배너 슬라이더 ────────────────────────────────────────────────────────────

const SLIDES = [
  { id: 'intro',    Component: SlideIntro },
  { id: 'creators', Component: SlideCreators },
  { id: 'market',  Component: SlideMarket },
]

function HeroBanner() {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef(null)

  const go = useCallback((idx) => {
    setCurrent((idx + SLIDES.length) % SLIDES.length)
  }, [])

  const reset = useCallback((idx) => {
    clearInterval(timerRef.current)
    go(idx)
    timerRef.current = setInterval(() => go(idx + 1), 5000) // restart after manual nav
  }, [go])

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), 5000)
    return () => clearInterval(timerRef.current)
  }, [])

  const { Component } = SLIDES[current]

  return (
    <div className="max-w-6xl mx-auto px-5 py-5">
      <div className="relative h-[380px] md:h-[420px] rounded-2xl overflow-hidden">
        <div className="h-full">
          <Component />
        </div>

        {/* 이전/다음 화살표 */}
        <button
          onClick={() => reset(current - 1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => reset(current + 1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 backdrop-blur-sm text-white flex items-center justify-center transition-colors"
        >
          <ChevronRight size={16} />
        </button>

        {/* 도트 인디케이터 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => reset(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40 hover:bg-white/70'
            }`}
          />
        ))}
        </div>
      </div>
    </div>
  )
}

// ── 상품 카드 ────────────────────────────────────────────────────────────────

function ProductCard({ product, isWishlisted, onWishlist, onCart }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow duration-200 border border-surface-border">
      <Link to={`/products/${product.id}`} className="block relative">
        <div className="aspect-[4/3] overflow-hidden bg-surface">
          {product.thumbnailUrl ? (
            <img src={product.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📄</div>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onWishlist(product.id) }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Heart size={13} className={isWishlisted ? 'text-red-500' : 'text-gray-400'} fill={isWishlisted ? 'currentColor' : 'none'} />
        </button>
      </Link>

      <div className="p-3.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[9px] text-primary font-bold shrink-0">
            {product.sellerName?.[0] ?? '?'}
          </div>
          <span className="text-xs text-gray-400 truncate max-w-[60px]">{product.sellerName}</span>
          {product.reviewCount > 0 && (
            <>
              <span className="text-gray-200 text-xs">|</span>
              <Star size={10} className="text-yellow-400 fill-yellow-400 shrink-0" />
              <span className="text-xs font-semibold text-gray-700">{product.avgRating?.toFixed(1)}</span>
              <span className="text-xs text-gray-400">({product.reviewCount})</span>
            </>
          )}
        </div>
        <Link to={`/products/${product.id}`}>
          <h3 className="text-[13px] font-medium text-gray-800 line-clamp-2 leading-snug mb-3 hover:text-primary transition-colors">
            {product.title}
          </h3>
        </Link>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold text-gray-900">
            ₩{(product.priceKrw ?? product.price)?.toLocaleString()}
          </p>
          <button
            onClick={(e) => { e.preventDefault(); onCart(product.id) }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <ShoppingCart size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 홈 페이지 ────────────────────────────────────────────────────────────────

export default function Home() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [sort, setSort] = useState('newest')
  const [wishlisted, setWishlisted] = useState(new Set([2, 5]))

  useEffect(() => {
    productApi.getList({ sort, limit: 8 })
      .then(({ data }) => { if (data.items?.length) setProducts(data.items) })
      .catch(() => {})
  }, [sort])

  useEffect(() => {
    if (!isLoggedIn) return
    wishlistApi.getList()
      .then(({ data }) => setWishlisted(new Set((data ?? []).map((i) => i.productId))))
      .catch(() => {})
  }, [isLoggedIn])

  const handleWishlist = async (productId) => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    const alreadyIn = wishlisted.has(productId)
    setWishlisted((prev) => { const n = new Set(prev); alreadyIn ? n.delete(productId) : n.add(productId); return n })
    try {
      if (alreadyIn) { await wishlistApi.remove(productId); toast.success('찜 목록에서 제거되었습니다.') }
      else { await wishlistApi.add(productId); toast.success('찜 목록에 추가되었습니다.') }
    } catch {
      setWishlisted((prev) => { const n = new Set(prev); alreadyIn ? n.add(productId) : n.delete(productId); return n })
    }
  }

  const handleCart = async (productId) => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    try { await cartApi.add(productId); toast.success('장바구니에 추가되었습니다.') } catch {}
  }

  const sortedProducts = [...products].sort((a, b) => {
    if (sort === 'price_asc') return a.priceKrw - b.priceKrw
    return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0)
  }).slice(0, 4)

  return (
    <div>
      {/* ── 배너 ── */}
      <HeroBanner />

      {/* ── 상품 섹션 ── */}
      <div className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-5 py-10">
          {/* 섹션 헤더 */}
          <div className="flex items-end justify-between mb-7">
            <div>
              <span className="inline-block text-[11px] font-bold text-primary tracking-[0.15em] uppercase mb-2">마켓플레이스</span>
              <h2 className="text-[22px] font-extrabold text-gray-900 leading-tight">인기 상품</h2>
              <p className="text-sm text-gray-400 mt-1">최신 등록된 AI 노하우·족보·강의자료</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-surface border border-surface-border rounded-lg p-0.5">
                {[
                  { value: 'newest',    label: '최신순' },
                  { value: 'price_asc', label: '가격순' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setSort(value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      sort === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Link
                to="/market"
                className="flex items-center gap-1.5 text-sm text-primary font-semibold border border-primary/25 hover:bg-primary/5 px-4 py-2 rounded-lg transition-colors"
              >
                전체 보기
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          {/* 4열 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {sortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlisted.has(product.id)}
                onWishlist={handleWishlist}
                onCart={handleCart}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── 인기 크리에이터 섹션 ── */}
      <div className="border-t border-surface-border bg-surface">
        <div className="max-w-6xl mx-auto px-5 py-10">
          {/* 섹션 헤더 */}
          <div className="flex items-end justify-between mb-7">
            <div>
              <span className="inline-block text-[11px] font-bold text-primary tracking-[0.15em] uppercase mb-2">이달의 크리에이터</span>
              <h2 className="text-[22px] font-extrabold text-gray-900 leading-tight">인기 크리에이터 TOP 3</h2>
              <p className="text-sm text-gray-400 mt-1">별점과 거래량으로 선정한 이달의 베스트 셀러</p>
            </div>
            <Link
              to="/creators/monthly"
              className="flex items-center gap-1.5 text-sm text-primary font-semibold border border-primary/25 hover:bg-primary/5 px-4 py-2 rounded-lg transition-colors"
            >
              전체 순위
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TOP_CREATORS.map((c, i) => {
              const medal = ['🥇', '🥈', '🥉'][i]
              const rankColor = [
                { ring: 'ring-yellow-300', badge: 'bg-yellow-400', avatar: 'bg-yellow-50 text-yellow-600', accent: 'text-yellow-500' },
                { ring: 'ring-gray-300',   badge: 'bg-gray-400',   avatar: 'bg-gray-100 text-gray-500',   accent: 'text-gray-400'   },
                { ring: 'ring-amber-400',  badge: 'bg-amber-500',  avatar: 'bg-amber-50 text-amber-600',  accent: 'text-amber-500'  },
              ][i]
              return (
                <Link
                  key={c.rank}
                  to={`/seller/${c.sellerAddress}`}
                  className={`group relative bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(21,87,255,0.13)] ${
                    i === 0 ? 'border-primary/20 shadow-[0_4px_20px_rgba(21,87,255,0.10)]' : 'border-surface-border shadow-sm'
                  }`}
                >
                  {/* 상단 컬러 띠 */}
                  <div className={`h-1.5 w-full ${rankColor.badge}`} />

                  <div className="p-5 flex flex-col flex-1">
                    {/* 순위 + 메달 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-8 h-8 rounded-full ${rankColor.badge} flex items-center justify-center text-white text-sm font-black shadow-sm`}>
                        {c.rank}
                      </div>
                      <span className="text-xl leading-none">{medal}</span>
                    </div>

                    {/* 아바타 */}
                    <div className={`w-14 h-14 rounded-full ${rankColor.avatar} flex items-center justify-center text-2xl font-bold mb-3 ring-2 ${rankColor.ring} ring-offset-2`}>
                      {c.name[0]}
                    </div>

                    {/* 이름 + 전문분야 */}
                    <p className="text-[15px] font-extrabold text-gray-900 mb-0.5 group-hover:text-primary transition-colors">{c.name}</p>
                    <p className={`text-xs font-semibold mb-2 ${rankColor.accent}`}>{c.specialty}</p>

                    {/* 바이오 */}
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 mb-4 flex-1">{c.bio}</p>

                    {/* 통계 */}
                    <div className="flex items-center gap-3 pt-3 border-t border-surface-border text-xs">
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={10} className={s <= Math.round(c.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'} />
                        ))}
                        <span className="font-bold text-gray-800 ml-0.5">{c.rating}</span>
                      </div>
                      <span className="text-gray-200">|</span>
                      <span className="text-gray-500">판매 <strong className="text-gray-700">{c.sales}</strong>건</span>
                    </div>
                  </div>

                  {/* 하단 CTA */}
                  <div className="px-5 pb-4">
                    <div className="w-full py-2 rounded-lg border border-surface-border text-xs font-semibold text-gray-500 text-center group-hover:border-primary group-hover:text-primary group-hover:bg-primary/5 transition-colors">
                      판매자 페이지 보기 →
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

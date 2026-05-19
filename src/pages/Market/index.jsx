import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Heart, ShoppingCart, Star, X, ChevronDown, SlidersHorizontal } from 'lucide-react'
import { productApi, wishlistApi, cartApi } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { useCartWishlistStore } from '../../store/cartWishlistStore'
import toast from 'react-hot-toast'

const FILE_TYPES = ['전체', 'PDF', 'PNG·JPG', 'TXT', 'ZIP']
const SORT_OPTIONS = [
  { value: 'newest',     label: '최신순' },
  { value: 'oldest',     label: '오래된순' },
  { value: 'price_asc',  label: '가격낮은순' },
  { value: 'price_desc', label: '가격높은순' },
]

const MOCK_PRODUCTS = [
  { id: 1,  fileType: 'PDF',     title: 'ChatGPT 활용 수능 영어 지문 분석 족보 마스터팩',           sellerName: '김민준', sellerAddress: 'addr1',  priceKrw: 12000, avgRating: 4.8, reviewCount: 134, thumbnailUrl: 'https://picsum.photos/seed/ai1/400/300',  createdAt: '2025-11-10' },
  { id: 2,  fileType: 'TXT',     title: 'Claude 3.5 논문 요약 자동화 프롬프트 세트 (20장)',          sellerName: '이서연', sellerAddress: 'addr2',  priceKrw: 8500,  avgRating: 4.6, reviewCount: 87,  thumbnailUrl: 'https://picsum.photos/seed/ai2/400/300',  createdAt: '2025-11-08' },
  { id: 3,  fileType: 'PDF',     title: '공무원 한국사 AI 정리 족보 2025 최신판',                    sellerName: '박도윤', sellerAddress: 'addr3',  priceKrw: 15000, avgRating: 4.9, reviewCount: 212, thumbnailUrl: 'https://picsum.photos/seed/ai3/400/300',  createdAt: '2025-11-05' },
  { id: 4,  fileType: 'PNG·JPG', title: '스타트업 IR 덱 시각화 자료 + GPT 활용 인포그래픽 팩',      sellerName: '최유리', sellerAddress: 'addr4',  priceKrw: 29000, avgRating: 5.0, reviewCount: 43,  thumbnailUrl: 'https://picsum.photos/seed/ai4/400/300',  createdAt: '2025-11-03' },
  { id: 5,  fileType: 'ZIP',     title: 'AI 도구 완전 정복 강의자료 패키지 — ChatGPT 입문',         sellerName: '정하은', sellerAddress: 'addr5',  priceKrw: 6000,  avgRating: 4.3, reviewCount: 56,  thumbnailUrl: 'https://picsum.photos/seed/ai5/400/300',  createdAt: '2025-10-30' },
  { id: 6,  fileType: 'PDF',     title: '경영학 전공 기말 족보 AI 분석팩 — 핵심 요약 + 예상문제',   sellerName: '한지호', sellerAddress: 'addr6',  priceKrw: 19000, avgRating: 4.7, reviewCount: 98,  thumbnailUrl: 'https://picsum.photos/seed/ai6/400/300',  createdAt: '2025-10-25' },
  { id: 7,  fileType: 'PDF',     title: '대학원 연구계획서 작성 가이드 + Claude 프롬프트 템플릿',   sellerName: '오세진', sellerAddress: 'addr7',  priceKrw: 11000, avgRating: 4.5, reviewCount: 31,  thumbnailUrl: 'https://picsum.photos/seed/ai7/400/300',  createdAt: '2025-10-20' },
  { id: 8,  fileType: 'TXT',     title: 'GPT-4o 업무 생산성 극대화 노하우 — 직장인 실전 프롬프트', sellerName: '윤다인', sellerAddress: 'addr8',  priceKrw: 7500,  avgRating: 4.4, reviewCount: 72,  thumbnailUrl: 'https://picsum.photos/seed/ai8/400/300',  createdAt: '2025-10-15' },
  { id: 9,  fileType: 'TXT',     title: '취업 자소서 첨삭 AI 프롬프트 — 대기업 합격 후기 포함',    sellerName: '강서준', sellerAddress: 'addr9',  priceKrw: 9000,  avgRating: 4.6, reviewCount: 61,  thumbnailUrl: 'https://picsum.photos/seed/ai9/400/300',  createdAt: '2025-10-10' },
  { id: 10, fileType: 'PDF',     title: 'Claude로 논문 리뷰 자동화하기 — 연구자 AI 활용 노하우',   sellerName: '임지현', sellerAddress: 'addr10', priceKrw: 13500, avgRating: 4.8, reviewCount: 44,  thumbnailUrl: 'https://picsum.photos/seed/ai10/400/300', createdAt: '2025-10-05' },
  { id: 11, fileType: 'ZIP',     title: '공인중개사 시험 AI 요약 족보 + 기출 풀이 패키지',          sellerName: '윤태경', sellerAddress: 'addr11', priceKrw: 18000, avgRating: 4.5, reviewCount: 89,  thumbnailUrl: 'https://picsum.photos/seed/ai11/400/300', createdAt: '2025-09-28' },
  { id: 12, fileType: 'PNG·JPG', title: 'AI 이미지 생성 활용 강의자료 — Stable Diffusion 비주얼팩', sellerName: '배수민', sellerAddress: 'addr12', priceKrw: 22000, avgRating: 4.7, reviewCount: 53,  thumbnailUrl: 'https://picsum.photos/seed/ai12/400/300', createdAt: '2025-09-20' },
]

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-primary text-white'
          : 'bg-white text-gray-500 border border-surface-border hover:border-gray-300 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function ProductCard({ product, isWishlisted, onWishlist, onCart }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden group hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] transition-shadow duration-200 border border-surface-border">
      <Link to={`/products/${product.id}`} className="block relative">
        <div className="aspect-[4/3] overflow-hidden bg-surface">
          {product.thumbnailUrl ? (
            <img
              src={product.thumbnailUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-20">📄</div>
          )}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onWishlist(product.id) }}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/95 shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
        >
          <Heart
            size={13}
            className={isWishlisted ? 'text-red-500' : 'text-gray-400'}
            fill={isWishlisted ? 'currentColor' : 'none'}
          />
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

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-surface-border animate-pulse">
      <div className="aspect-[4/3] bg-surface" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 bg-surface rounded w-1/2" />
        <div className="h-3.5 bg-surface rounded w-full" />
        <div className="h-3.5 bg-surface rounded w-4/5" />
        <div className="h-4 bg-surface rounded w-1/3 mt-1" />
      </div>
    </div>
  )
}

export default function Market() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const { incrementWishlist, decrementWishlist, incrementCart } = useCartWishlistStore()
  const [products, setProducts] = useState(MOCK_PRODUCTS)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState('newest')
  const [fileType, setFileType] = useState('전체')
  const [filterOpen, setFilterOpen] = useState(false)
  const [wishlisted, setWishlisted] = useState(new Set([2, 5]))

  const loadProducts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await productApi.getList({ search, sort, limit: 20 })
      setProducts(data.items ?? MOCK_PRODUCTS)
    } catch {
      setProducts(MOCK_PRODUCTS)
    } finally {
      setLoading(false)
    }
  }, [search, sort])

  useEffect(() => { loadProducts() }, [loadProducts])

  useEffect(() => {
    if (!isLoggedIn) return
    wishlistApi.getList().then(({ data }) => {
      setWishlisted(new Set((data ?? []).map((i) => i.productId)))
    }).catch(() => {})
  }, [isLoggedIn])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleWishlist = async (productId) => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    const alreadyIn = wishlisted.has(productId)
    setWishlisted((prev) => {
      const next = new Set(prev)
      alreadyIn ? next.delete(productId) : next.add(productId)
      return next
    })
    try {
      if (alreadyIn) {
        await wishlistApi.remove(productId)
        decrementWishlist()
        toast.success('찜 목록에서 제거되었습니다.')
      } else {
        await wishlistApi.add(productId)
        incrementWishlist()
        toast.success('찜 목록에 추가되었습니다.')
      }
    } catch {
      setWishlisted((prev) => {
        const next = new Set(prev)
        alreadyIn ? next.add(productId) : next.delete(productId)
        return next
      })
    }
  }

  const handleCart = async (productId) => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    try {
      await cartApi.add(productId)
      incrementCart()
      toast.success('장바구니에 추가되었습니다.')
    } catch {}
  }

  const isFiltered = fileType !== '전체' || sort !== 'newest' || search !== ''
  const handleReset = () => {
    setSearch('')
    setSearchInput('')
    setFileType('전체')
    setSort('newest')
    setFilterOpen(false)
  }

  const displayed = products
    .filter((p) => fileType === '전체' || p.fileType === fileType)
    .filter((p) => !search || p.title.includes(search) || p.sellerName.includes(search))
    .sort((a, b) => {
      if (sort === 'newest')     return new Date(b.createdAt) - new Date(a.createdAt)
      if (sort === 'oldest')     return new Date(a.createdAt) - new Date(b.createdAt)
      if (sort === 'price_asc')  return a.priceKrw - b.priceKrw
      if (sort === 'price_desc') return b.priceKrw - a.priceKrw
      return 0
    })

  return (
    <div>
      {/* ── 히어로 ── */}
      <div className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-5 py-10 text-center">
          <p className="text-xs font-semibold text-primary mb-3">AI 활용 노하우 · 족보 · 강의자료 마켓플레이스</p>
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight mb-2">
            필요한 AI 노하우를 찾아보세요
          </h1>
          <p className="text-gray-400 text-sm mb-7">프롬프트 · 족보 · 강의자료 — Fabric 에스크로로 안전하게 거래</p>

          <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="input pl-10 h-11"
                placeholder="프롬프트, 족보, 강의자료 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary px-5 h-11 shrink-0">검색</button>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-5 h-11 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
              >
                <X size={13} />
                초기화
              </button>
            )}
          </form>
        </div>
      </div>

      {/* ── 정렬·필터 툴바 ── */}
      <div className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          {/* 왼쪽: 정렬 칩 */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {SORT_OPTIONS.map((opt) => (
              <Chip key={opt.value} active={sort === opt.value} onClick={() => setSort(opt.value)}>
                {opt.label}
              </Chip>
            ))}
          </div>

          {/* 오른쪽: 파일 형식 필터 토글 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                fileType !== '전체'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-600 border-surface-border hover:border-gray-300'
              }`}
            >
              <SlidersHorizontal size={13} />
              {fileType === '전체' ? '파일 형식' : `.${fileType}`}
              <ChevronDown size={13} className={`transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 드롭다운 */}
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 bg-white border border-surface-border rounded-xl shadow-lg p-3 z-20 min-w-[160px]">
                <p className="text-[11px] text-gray-400 font-medium px-1 mb-2">파일 형식</p>
                <div className="flex flex-col gap-1">
                  {FILE_TYPES.map((ft) => (
                    <button
                      key={ft}
                      onClick={() => { setFileType(ft); setFilterOpen(false) }}
                      className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        fileType === ft
                          ? 'bg-primary/10 text-primary'
                          : 'text-gray-600 hover:bg-surface'
                      }`}
                    >
                      {ft === '전체' ? '전체' : `.${ft}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 상품 목록 ── */}
      <div className="max-w-6xl mx-auto px-5 py-7">
        <p className="text-sm text-gray-500 mb-5">
          {loading ? '불러오는 중...' : (
            <><span className="font-semibold text-gray-900">{displayed.length}</span>개 결과</>
          )}
        </p>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-28">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-gray-500 font-medium mb-1">
              {search ? `"${search}" 검색 결과가 없습니다` : `.${fileType} 형식의 상품이 없습니다`}
            </p>
            <p className="text-sm text-gray-400">다른 파일 형식을 선택하거나 검색어를 바꿔보세요</p>
            <button
              onClick={() => { setSearch(''); setSearchInput(''); setFileType('전체') }}
              className="mt-4 text-sm text-primary hover:underline"
            >
              전체 목록 보기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayed.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlisted.has(product.id)}
                onWishlist={handleWishlist}
                onCart={handleCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

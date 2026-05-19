import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Package, Eye, EyeOff, Edit3, Check, X } from 'lucide-react'
import { sellerApi, reviewApi, productApi } from '../../api'
import { StarRating } from '../../components/modals/ReviewModal'
import TokenBadge from '../../components/common/TokenBadge'
import toast from 'react-hot-toast'

// status: SELLING(판매중) | TRADING(거래중, 구매확정 전) | COMPLETED(판매 완료)
const MOCK_DATA = {
  addr1: {
    seller: { name: '김민준', bio: 'ChatGPT 프롬프트 엔지니어링 전문가. 3년간 AI 노하우를 공유해 왔으며 수능·취업·업무 자동화 분야 프롬프트 팩을 다수 보유하고 있습니다.', totalProducts: 8, totalSales: 134, isOwner: false },
    products: [
      { id: 1,  title: 'ChatGPT 활용 수능 영어 지문 분석 족보 마스터팩',        priceKrw: 12000, isVisible: true,  status: 'SELLING',   thumbnail: 'https://picsum.photos/seed/ai1/400/300' },
      { id: 10, title: 'ChatGPT 단어 암기 프롬프트 세트 — 영어 수능 특화',       priceKrw: 9000,  isVisible: true,  status: 'TRADING',   thumbnail: 'https://picsum.photos/seed/ai10b/400/300' },
      { id: 11, title: '취업 자기소개서 첨삭 GPT 프롬프트 팩',                    priceKrw: 15000, isVisible: false, status: 'COMPLETED', thumbnail: 'https://picsum.photos/seed/ai11b/400/300' },
    ],
    reviews: [
      { id: 1, rating: 5, buyerName: '이**', createdAt: '2025-10-20', content: '정말 유용한 프롬프트였습니다. 수능 영어 준비에 큰 도움이 됐어요!', productTitle: 'ChatGPT 활용 수능 영어 지문 분석 족보 마스터팩', productId: 1 },
      { id: 2, rating: 5, buyerName: '박**', createdAt: '2025-10-15', content: '퀄리티가 기대 이상이에요. 덕분에 자소서 합격했습니다.', productTitle: '취업 자기소개서 첨삭 GPT 프롬프트 팩', productId: 11 },
      { id: 3, rating: 4, buyerName: '최**', createdAt: '2025-10-05', content: '내용이 체계적으로 잘 정리돼 있어서 바로 써먹을 수 있었어요.', productTitle: 'ChatGPT 단어 암기 프롬프트 세트', productId: 10 },
    ],
  },
  addr2: {
    seller: { name: '이서연', bio: 'Claude API를 활용한 업무 자동화 전문가. 논문 요약·보고서 작성·데이터 분석 프롬프트 세트를 꾸준히 업로드하고 있습니다.', totalProducts: 6, totalSales: 98, isOwner: false },
    products: [
      { id: 2,  title: 'Claude 3.5 논문 요약 자동화 프롬프트 세트 (20장)',       priceKrw: 8500,  isVisible: true,  status: 'SELLING',   thumbnail: 'https://picsum.photos/seed/ai2/400/300' },
      { id: 20, title: 'Claude로 이메일 자동 작성하기 — 직장인 프롬프트 25종',   priceKrw: 7000,  isVisible: true,  status: 'TRADING',   thumbnail: 'https://picsum.photos/seed/ai20/400/300' },
      { id: 21, title: 'Claude API 연동 데이터 분석 리포트 자동화 가이드',        priceKrw: 19000, isVisible: false, status: 'COMPLETED', thumbnail: 'https://picsum.photos/seed/ai21/400/300' },
    ],
    reviews: [
      { id: 10, rating: 5, buyerName: '김**', createdAt: '2025-10-25', content: '논문 요약 프롬프트 퀄리티가 훌륭해요. 연구자에게 강추!', productTitle: 'Claude 3.5 논문 요약 자동화 프롬프트 세트', productId: 2 },
      { id: 11, rating: 4, buyerName: '정**', createdAt: '2025-10-18', content: '이메일 작성 시간이 절반으로 줄었습니다. 매우 실용적이에요.', productTitle: 'Claude로 이메일 자동 작성하기', productId: 20 },
    ],
  },
  addr3: {
    seller: { name: '박도윤', bio: 'AI로 정리한 수능·공무원·자격증 시험 족보 전문 제작자. 핵심 요약 + 예상문제 세트로 많은 학습자에게 호평받고 있습니다.', totalProducts: 5, totalSales: 87, isOwner: false },
    products: [
      { id: 3,  title: '공무원 한국사 AI 정리 족보 2025 최신판',                  priceKrw: 15000, isVisible: true,  status: 'SELLING',   thumbnail: 'https://picsum.photos/seed/ai3/400/300' },
      { id: 30, title: '수능 수학 AI 핵심 공식 족보 + 기출 유형 분석',             priceKrw: 12000, isVisible: true,  status: 'TRADING',   thumbnail: 'https://picsum.photos/seed/ai30/400/300' },
      { id: 31, title: '공인중개사 시험 AI 족보 — 부동산공법 핵심 정리',           priceKrw: 18000, isVisible: false, status: 'COMPLETED', thumbnail: 'https://picsum.photos/seed/ai31/400/300' },
    ],
    reviews: [
      { id: 20, rating: 5, buyerName: '윤**', createdAt: '2025-11-01', content: '한국사 시험 2주 전에 구매했는데 정말 도움 많이 됐어요!', productTitle: '공무원 한국사 AI 정리 족보 2025 최신판', productId: 3 },
      { id: 21, rating: 5, buyerName: '강**', createdAt: '2025-10-28', content: '핵심만 쏙 빼서 정리해줘서 공부 시간이 확 줄었습니다.', productTitle: '수능 수학 AI 핵심 공식 족보', productId: 30 },
      { id: 22, rating: 4, buyerName: '임**', createdAt: '2025-10-10', content: '예상문제 적중률이 꽤 높았어요. 다음 시험 자료도 기다리겠습니다.', productTitle: '공인중개사 시험 AI 족보', productId: 31 },
    ],
  },
}

const STATUS_CONFIG = {
  SELLING:   { label: '판매중',   className: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  TRADING:   { label: '거래중',   className: 'bg-amber-50  text-amber-600  border-amber-200'  },
  COMPLETED: { label: '판매 완료', className: 'bg-gray-100  text-gray-400   border-gray-200'   },
}

function ReviewCard({ review }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                className={s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
              />
            ))}
          </div>
          <p className="text-sm font-semibold text-gray-900">{review.buyerName}</p>
        </div>
        <p className="text-xs text-gray-400">
          {new Date(review.createdAt).toLocaleDateString('ko-KR')}
        </p>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{review.content}</p>
      {review.productId ? (
        <Link
          to={`/products/${review.productId}`}
          className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
        >
          <Package size={11} />
          {review.productTitle}
        </Link>
      ) : (
        <p className="text-xs text-gray-400">{review.productTitle}</p>
      )}
    </div>
  )
}

function ProductCard({ product, isMine, onToggleVisibility }) {
  const status = product.status ?? 'SELLING'
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.SELLING
  const isCompleted = status === 'COMPLETED'

  return (
    <Link
      to={`/products/${product.id}`}
      className={`card flex items-center gap-4 transition-all hover:shadow-md ${
        isCompleted ? 'opacity-70 hover:border-gray-300' : 'hover:border-primary/40'
      }`}
    >
      {/* 썸네일 + 판매 완료 오버레이 */}
      <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt=""
            className={`w-full h-full object-cover ${isCompleted ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="w-full h-full bg-surface flex items-center justify-center text-2xl">📄</div>
        )}
        {isCompleted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="w-11 h-11 rounded-full border-2 border-white/80 flex items-center justify-center text-white text-[9px] font-bold text-center leading-tight">
              판매<br />완료
            </span>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-gray-900 font-medium truncate text-sm">{product.title}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>₩{(product.priceKrw ?? product.price)?.toLocaleString()}</span>
        </div>
      </div>

      {/* 상태 배지 */}
      <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${cfg.className}`}>
        {cfg.label}
      </span>

      {/* 내 상품: 공개/비공개 토글 */}
      {isMine && (
        <button
          onClick={(e) => { e.preventDefault(); onToggleVisibility(product.id) }}
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            product.isVisible
              ? 'text-emerald-400 hover:bg-emerald-500/10'
              : 'text-gray-400 hover:bg-surface'
          }`}
          title={product.isVisible ? '비공개로 전환' : '공개로 전환'}
        >
          {product.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      )}
    </Link>
  )
}

function EditableBio({ bio, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(bio)

  const handleSave = async () => {
    await onSave(draft)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="text-gray-600 text-sm flex-1 leading-relaxed">
          {bio || '소개글이 없습니다.'}
        </p>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-gray-400 transition-colors"
        >
          <Edit3 size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <textarea
        className="input resize-none text-sm"
        rows={4}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={500}
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => { setDraft(bio); setEditing(false) }}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
        >
          <X size={16} />
        </button>
        <button
          onClick={handleSave}
          className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
        >
          <Check size={16} />
        </button>
      </div>
    </div>
  )
}

export default function SellerPage() {
  const { id: address } = useParams()

  const [seller, setSeller] = useState(null)
  const [products, setProducts] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('products')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sellerRes, productsRes, reviewsRes] = await Promise.all([
          sellerApi.getProfile(address),
          sellerApi.getProducts(address),
          reviewApi.getBySeller(address),
        ])
        setSeller(sellerRes.data)
        setProducts(productsRes.data?.items ?? [])
        setReviews(reviewsRes.data?.items ?? [])
      } catch {
        const mock = MOCK_DATA[address]
        if (mock) {
          setSeller(mock.seller)
          setProducts(mock.products)
          setReviews(mock.reviews)
        }
      } finally {
        setLoading(false)
      }
    }
    if (address) load()
  }, [address])

  const toggleVisibility = async (productId) => {
    try {
      await productApi.toggleVisibility(productId)
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, isVisible: !p.isVisible } : p))
      )
      toast.success('공개 상태가 변경되었습니다.')
    } catch {}
  }

  const saveBio = async (bio) => {
    try {
      await sellerApi.updateProfile({ bio })
      setSeller((prev) => ({ ...prev, bio }))
      toast.success('소개글이 저장되었습니다.')
    } catch {}
  }

  const isMine = seller?.isOwner ?? false

  const visibleProducts = isMine
    ? products
    : products.filter((p) => p.isVisible)

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="card animate-pulse h-40" />
        <div className="card animate-pulse h-64" />
      </div>
    )
  }

  if (!seller) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">판매자를 찾을 수 없습니다.</p>
      </div>
    )
  }

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 판매자 프로필 */}
      <div className="card mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          {/* 아바타 */}
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl shrink-0">
            {seller.name?.[0] ?? '?'}
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-xl font-bold text-gray-900">{seller.name}</h1>
              {isMine && (
                <span className="badge bg-primary/10 text-primary text-xs">내 페이지</span>
              )}
            </div>

            <div className="flex items-center gap-1 mb-2">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm text-gray-900 font-semibold">{avgRating ?? '—'}</span>
              <span className="text-sm text-gray-500">({reviews.length}개 리뷰)</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-mono">@{address}</span>
            </div>
          </div>

          {/* 통계 */}
          <div className="flex gap-4 shrink-0">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{seller.totalProducts ?? 0}</p>
              <p className="text-xs text-gray-500">등록 상품</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{seller.totalSales ?? 0}</p>
              <p className="text-xs text-gray-500">누적 판매</p>
            </div>
          </div>
        </div>

        {/* 토큰 퍼센테이지 */}
        {seller.tokenPct != null && (
          <div className="mt-4 pt-4 border-t border-surface-border">
            <TokenBadge pct={seller.tokenPct} size={isMine ? 'md' : 'sm'} />
          </div>
        )}

        {/* 소개글 */}
        <div className="mt-4 pt-4 border-t border-surface-border">
          {isMine ? (
            <EditableBio bio={seller.bio} onSave={saveBio} />
          ) : (
            <p className="text-gray-600 text-sm leading-relaxed">
              {seller.bio || '소개글이 없습니다.'}
            </p>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-2xl p-1 mb-5">
        {[
          { id: 'products', label: `상품 (${visibleProducts.length})`, icon: Package },
          { id: 'reviews', label: `리뷰 (${reviews.length})`, icon: Star },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium flex-1 justify-center transition-colors ${
              activeTab === id ? 'bg-primary text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* 상품 목록 */}
      {activeTab === 'products' && (
        <div className="space-y-3">
          {visibleProducts.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">등록된 상품이 없습니다.</p>
            </div>
          ) : (
            visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isMine={isMine}
                onToggleVisibility={toggleVisibility}
              />
            ))
          )}
        </div>
      )}

      {/* 리뷰 목록 */}
      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">아직 리뷰가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* 별점 평균 요약 */}
              {avgRating && (
                <div className="card flex items-center gap-4 mb-4">
                  <p className="text-5xl font-bold text-gray-900">{avgRating}</p>
                  <div>
                    <StarRating value={Math.round(Number(avgRating))} readonly />
                    <p className="text-sm text-gray-500 mt-1">{reviews.length}개 리뷰 평균</p>
                  </div>
                </div>
              )}
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

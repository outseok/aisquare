import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Star, Heart, ShoppingCart, ArrowLeft, Shield, Package, ArrowRight } from 'lucide-react'
import { productApi, wishlistApi, cartApi } from '../../api'
import { useAuth } from '../../hooks/useAuth'
import { usePass } from '../../hooks/usePass'
import { useCartWishlistStore } from '../../store/cartWishlistStore'
import TokenBadge from '../../components/common/TokenBadge'
import AuthRequiredModal from '../../components/modals/AuthRequiredModal'
import toast from 'react-hot-toast'

const MOCK_PRODUCT = {
  id: 1,
  title: 'ChatGPT 족보 마스터팩 — 수능 영어 지문 완벽 분석 프롬프트',
  priceKrw: 12000,
  avgRating: 4.8,
  reviewCount: 134,
  thumbnailUrl: 'https://picsum.photos/seed/ai1/800/450',
  sellerName: '김민준',
  sellerAddress: 'addr1',
  sellerTokenPct: 72,
  description: `<h2>상품 소개</h2><p>수능 영어 지문을 ChatGPT로 완벽 분석하는 프롬프트 팩입니다. 구문 분석부터 어휘 추출, 요약 정리까지 한 번에 처리할 수 있습니다.</p><h3>포함 내용</h3><ul><li>지문 구문 분석 프롬프트 × 5종</li><li>어휘·숙어 추출 프롬프트 × 3종</li><li>문단 요약 자동화 프롬프트 × 4종</li><li>빈칸 추론 힌트 생성 프롬프트 × 2종</li></ul><h3>사용 방법</h3><p>각 프롬프트를 ChatGPT 4o 이상 모델에 붙여넣고, 분석할 지문을 이어서 입력하면 됩니다. 상세 가이드 PDF가 함께 제공됩니다.</p><blockquote>실제 수능 2024 영어 47번 지문으로 테스트한 결과, 핵심 문장 추출 정확도 94% 달성</blockquote>`,
}


function StarRow({ rating, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { isPassVerified } = usePass()
  const { incrementWishlist, decrementWishlist, incrementCart } = useCartWishlistStore()

  const [product, setProduct] = useState(MOCK_PRODUCT)
  const [loading, setLoading] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [authAction, setAuthAction] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const prodRes = await productApi.getById(id)
        setProduct(prodRes.data)
      } catch {
        setProduct(MOCK_PRODUCT)
      } finally {
        setLoading(false)
      }
    }
    if (id) load()
  }, [id])

  useEffect(() => {
    if (!isLoggedIn || !id) return
    wishlistApi.getList().then(({ data }) => {
      setIsWishlisted((data ?? []).some((i) => String(i.productId) === String(id)))
    }).catch(() => {})
  }, [isLoggedIn, id])

  const handleWishlist = async () => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    const prev = isWishlisted
    setIsWishlisted(!prev)
    try {
      if (prev) {
        await wishlistApi.remove(id)
        decrementWishlist()
        toast.success('찜 목록에서 제거되었습니다.')
      } else {
        await wishlistApi.add(id)
        incrementWishlist()
        toast.success('찜 목록에 추가되었습니다.')
      }
    } catch { setIsWishlisted(prev) }
  }

  const handleCart = async () => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    try {
      await cartApi.add(id)
      incrementCart()
      toast.success('장바구니에 추가되었습니다.')
    } catch {}
  }

  const handleBuy = () => {
    if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); navigate('/login'); return }
    if (!isPassVerified) { setAuthAction('purchase'); return }
    navigate('/checkout', {
      state: {
        items: [{
          productId: product.id,
          productTitle: product.title,
          priceKrw: product.priceKrw ?? product.price,
          thumbnail: product.thumbnailUrl,
          sellerName: product.sellerName,
        }],
      },
    })
  }

  const avgRating = product?.avgRating ?? null
  const reviewCount = product?.reviewCount ?? 0

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-8 animate-pulse">
        <div className="h-4 bg-surface rounded w-20 mb-6" />
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-video bg-surface rounded-xl" />
          <div className="space-y-4">
            <div className="h-5 bg-surface rounded w-4/5" />
            <div className="h-4 bg-surface rounded w-1/3" />
            <div className="h-24 bg-surface rounded" />
            <div className="h-11 bg-surface rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-5 py-24 text-center">
        <Package size={40} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500 mb-2">상품을 찾을 수 없습니다.</p>
        <Link to="/" className="text-sm text-primary hover:underline">마켓으로 돌아가기</Link>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-5xl mx-auto px-5 py-7">
        {/* 뒤로가기 */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-7 transition-colors"
        >
          <ArrowLeft size={14} />
          마켓으로
        </Link>

        {/* 상단 2열 */}
        <div className="grid md:grid-cols-[1fr_340px] gap-10 mb-10">
          {/* 썸네일 */}
          <div className="aspect-video bg-surface rounded-xl overflow-hidden border border-surface-border">
            {product.thumbnailUrl ? (
              <img src={product.thumbnailUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">📄</div>
            )}
          </div>

          {/* 정보 패널 */}
          <div className="flex flex-col gap-5">
            {/* 제목 + 별점 */}
            <div>
              <h1 className="text-[19px] font-bold text-gray-900 leading-snug mb-3">{product.title}</h1>
              {avgRating && (
                <div className="flex items-center gap-2">
                  <StarRow rating={Math.round(Number(avgRating))} size={13} />
                  <span className="text-sm font-bold text-gray-900">{Number(avgRating).toFixed(1)}</span>
                  <span className="text-xs text-gray-400">({reviewCount}개 리뷰)</span>
                </div>
              )}
            </div>

            {/* 판매자 */}
            <Link
              to={`/seller/${product.sellerAddress}`}
              className="flex items-center gap-2.5 group w-fit"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm text-primary font-bold shrink-0">
                {product.sellerName?.[0] ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 group-hover:text-primary transition-colors">{product.sellerName}</p>
                {product.sellerTokenPct != null && (
                  <div className="mt-0.5">
                    <TokenBadge pct={product.sellerTokenPct} size="sm" />
                  </div>
                )}
              </div>
            </Link>

            {/* 구분선 */}
            <hr className="border-surface-border" />

            {/* 가격 */}
            <div>
              <p className="text-xs text-gray-400 mb-1">판매 금액</p>
              <p className="text-[30px] font-bold text-gray-900 leading-none">
                ₩{(product.priceKrw ?? product.price)?.toLocaleString()}
              </p>
            </div>

            {/* 에스크로 안내 */}
            <div className="flex items-start gap-2 bg-surface rounded-lg px-3.5 py-3">
              <Shield size={13} className="text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 leading-relaxed">
                결제 대금은 <span className="font-medium text-gray-700">Fabric 에스크로</span>에 보관됩니다.
                72시간 내 확정 또는 신고 가능하며, 미확정 시 자동 정산됩니다.
              </p>
            </div>

            {/* 버튼 그룹 */}
            <div className="space-y-2 mt-auto">
              <button onClick={handleBuy} className="btn-primary w-full py-3 text-[15px]">
                즉시 구매
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleCart}
                  className="btn-secondary flex items-center justify-center gap-1.5 py-2.5"
                >
                  <ShoppingCart size={14} />
                  장바구니
                </button>
                <button
                  onClick={handleWishlist}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
                    isWishlisted
                      ? 'bg-red-50 border-red-200 text-red-500'
                      : 'bg-white border-surface-border text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <Heart size={14} fill={isWishlisted ? 'currentColor' : 'none'} />
                  {isWishlisted ? '찜됨' : '찜하기'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <hr className="border-surface-border mb-6" />

        {/* 상품 설명 헤더 */}
        <h2 className="text-[15px] font-bold text-gray-900 border-b border-surface-border pb-3 mb-6">상품 설명</h2>

        {/* 상품 설명 */}
        <div className="min-h-[200px] max-w-2xl mb-10">
          {product.description ? (
            <div
              className="product-description"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          ) : (
            <p className="text-gray-400 text-center py-14">상품 설명이 없습니다.</p>
          )}
        </div>

        {/* 판매자 리뷰 링크 */}
        {product.sellerAddress && (
          <div className="max-w-2xl border border-surface-border rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-0.5">판매자 리뷰</p>
              <p className="text-xs text-gray-400">구매자 리뷰는 판매자 페이지에서 확인할 수 있습니다.</p>
            </div>
            <Link
              to={`/seller/${product.sellerAddress}`}
              className="flex items-center gap-1 text-sm text-primary font-semibold hover:underline shrink-0"
            >
              리뷰 보기
              <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </div>

      <AuthRequiredModal
        isOpen={!!authAction}
        onClose={() => setAuthAction(null)}
        action={authAction}
      />
    </div>
  )
}

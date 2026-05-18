import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Package, Eye, EyeOff, Edit3, Check, X } from 'lucide-react'
import { sellerApi, reviewApi, productApi } from '../../api'
import { StarRating } from '../../components/modals/ReviewModal'
import TokenBadge from '../../components/common/TokenBadge'
import toast from 'react-hot-toast'

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
                className={s <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-white">{review.buyerName}</p>
        </div>
        <p className="text-xs text-gray-600">
          {new Date(review.createdAt).toLocaleDateString('ko-KR')}
        </p>
      </div>
      <p className="text-sm text-gray-400 leading-relaxed">{review.content}</p>
      <p className="text-xs text-gray-600 mt-2">{review.productTitle}</p>
    </div>
  )
}

function ProductCard({ product, isMine, onToggleVisibility }) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="card hover:border-primary transition-colors flex items-center gap-4"
    >
      {product.thumbnail ? (
        <img
          src={product.thumbnail}
          alt=""
          className="w-14 h-14 object-cover rounded-lg shrink-0"
        />
      ) : (
        <div className="w-14 h-14 bg-surface rounded-lg shrink-0 flex items-center justify-center text-2xl">
          📄
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{product.title}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          <span>₩{(product.priceKrw ?? product.price)?.toLocaleString()}</span>
          <span>판매 {product.salesCount}건</span>
        </div>
      </div>
      {isMine && (
        <button
          onClick={(e) => { e.preventDefault(); onToggleVisibility(product.id) }}
          className={`shrink-0 p-2 rounded-lg transition-colors ${
            product.isVisible
              ? 'text-green-400 hover:bg-green-500/10'
              : 'text-gray-500 hover:bg-surface-border'
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
        <p className="text-gray-400 text-sm flex-1 leading-relaxed">
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
          className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
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
        // 인터셉터 처리
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
              <h1 className="text-xl font-bold text-white">{seller.name}</h1>
              {isMine && (
                <span className="badge bg-primary/10 text-primary text-xs">내 페이지</span>
              )}
            </div>

            <div className="flex items-center gap-1 mb-2">
              <Star size={14} className="text-yellow-400 fill-yellow-400" />
              <span className="text-sm text-white font-semibold">{avgRating ?? '—'}</span>
              <span className="text-sm text-gray-500">({reviews.length}개 리뷰)</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="font-mono">@{address}</span>
            </div>
          </div>

          {/* 통계 */}
          <div className="flex gap-4 shrink-0">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{seller.totalProducts ?? 0}</p>
              <p className="text-xs text-gray-500">등록 상품</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{seller.totalSales ?? 0}</p>
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
            <p className="text-gray-400 text-sm leading-relaxed">
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
              activeTab === id ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'
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
                  <p className="text-5xl font-bold text-white">{avgRating}</p>
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

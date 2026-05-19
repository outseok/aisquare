import { useState, useEffect } from 'react'
import { Eye, EyeOff, TrendingUp } from 'lucide-react'
import { productApi } from '../../api'
import toast from 'react-hot-toast'

export default function SalesHistory() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalSales: 0, totalRevenue: 0 })

  const loadProducts = async () => {
    setLoading(true)
    try {
      const { data } = await productApi.getList({ mine: true })
      setProducts(data.items ?? [])
      setStats({
        totalSales: data.totalSales ?? 0,
        totalRevenue: data.totalRevenue ?? 0,
      })
    } catch {
      // 인터셉터 처리
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProducts() }, [])

  const toggleVisibility = async (id) => {
    try {
      await productApi.toggleVisibility(id)
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isVisible: !p.isVisible } : p))
      )
      toast.success('공개 상태가 변경되었습니다.')
    } catch {}
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 요약 통계 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <TrendingUp size={20} className="mx-auto text-primary mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.totalSales.toLocaleString()}</p>
          <p className="text-sm text-gray-500">누적 판매 건수</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">누적 수익</p>
          <p className="text-2xl font-bold text-primary">{stats.totalRevenue.toLocaleString()} RP</p>
          <p className="text-sm text-gray-500">수수료 10% 차감 후</p>
        </div>
      </div>

      {/* 상품 목록 */}
      {products.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500 text-lg mb-1">등록한 상품이 없습니다</p>
          <p className="text-gray-600 text-sm">상품을 등록하고 수익을 올려보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="card">
              <div className="flex items-center gap-4 flex-wrap">
                {product.thumbnail ? (
                  <img
                    src={product.thumbnail}
                    alt=""
                    className="w-16 h-16 object-cover rounded-lg shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 bg-surface rounded-lg shrink-0 flex items-center justify-center text-2xl">
                    📄
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-semibold truncate">{product.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
                    <span>₩{(product.priceKrw ?? product.priceRp ?? product.price)?.toLocaleString()}</span>
                    <span>수익 {(product.revenue ?? 0).toLocaleString()} Square</span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => toggleVisibility(product.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      product.isVisible
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
                    }`}
                    title={product.isVisible ? '비공개로 전환' : '공개로 전환'}
                  >
                    {product.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                    {product.isVisible ? '공개' : '비공개'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

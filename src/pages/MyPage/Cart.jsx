import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2 } from 'lucide-react'
import { cartApi } from '../../api'
import toast from 'react-hot-toast'

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await cartApi.getList()
      setItems(data ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleRemove = async (productId) => {
    try {
      await cartApi.remove(productId)
      setItems((prev) => prev.filter((item) => item.productId !== productId))
      toast.success('장바구니에서 제거되었습니다.')
    } catch {}
  }

  const totalPrice = items.reduce((sum, item) => sum + (item.priceKrw ?? 0), 0)

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card animate-pulse h-20" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="card text-center py-16">
        <ShoppingCart size={32} className="mx-auto text-gray-600 mb-3" />
        <p className="text-gray-500 text-lg mb-1">장바구니가 비어있습니다</p>
        <p className="text-gray-600 text-sm">마켓에서 상품을 담아보세요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.productId} className="card flex items-center gap-4">
            {item.thumbnail ? (
              <img
                src={item.thumbnail}
                alt=""
                className="w-14 h-14 object-cover rounded-lg shrink-0"
              />
            ) : (
              <div className="w-14 h-14 bg-surface rounded-lg shrink-0 flex items-center justify-center text-2xl">
                📄
              </div>
            )}

            <Link to={`/products/${item.productId}`} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">
              <p className="text-white font-medium truncate">{item.productTitle}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                ₩{item.priceKrw?.toLocaleString()}
                <span className="mx-2">·</span>
                {item.sellerName}
              </p>
            </Link>

            <button
              onClick={() => handleRemove(item.productId)}
              className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* 합계 및 결제 */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-gray-400 text-sm">총 {items.length}개 상품</p>
          <p className="text-white font-bold text-lg">₩{totalPrice.toLocaleString()}</p>
        </div>
        <button
          onClick={() => navigate('/checkout', { state: { items } })}
          className="btn-primary w-full py-3"
        >
          일괄 결제
        </button>
      </div>
    </div>
  )
}

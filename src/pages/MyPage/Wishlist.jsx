import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import { wishlistApi } from '../../api'
import toast from 'react-hot-toast'

export default function Wishlist() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await wishlistApi.getList()
      setItems(data ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleRemove = async (productId) => {
    try {
      await wishlistApi.remove(productId)
      setItems((prev) => prev.filter((item) => item.productId !== productId))
      toast.success('찜 목록에서 제거되었습니다.')
    } catch {}
  }

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
        <Heart size={32} className="mx-auto text-gray-600 mb-3" />
        <p className="text-gray-500 text-lg mb-1">찜한 상품이 없습니다</p>
        <p className="text-gray-600 text-sm">마음에 드는 상품을 찜해보세요.</p>
      </div>
    )
  }

  return (
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
            <p className="text-gray-900 font-medium truncate">{item.productTitle}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              ₩{item.priceKrw?.toLocaleString()}
              <span className="mx-2">·</span>
              {item.sellerName}
            </p>
          </Link>

          <button
            onClick={() => handleRemove(item.productId)}
            className="p-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            title="찜 해제"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

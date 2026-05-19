import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, ArrowRight, Trophy } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'sales',   label: '판매량순' },
  { value: 'reviews', label: '리뷰순' },
  { value: 'rating',  label: '별점순' },
]

const MONTHLY_CREATORS = [
  { sellerAddress: 'addr1',  name: '김민준', specialty: 'ChatGPT 프롬프트',    rating: 4.9, reviewCount: 134, sales: 134, productCount: 8  },
  { sellerAddress: 'addr3',  name: '박도윤', specialty: '수능·자격증 족보',      rating: 4.7, reviewCount: 212, sales: 87,  productCount: 5  },
  { sellerAddress: 'addr2',  name: '이서연', specialty: 'Claude 자동화',        rating: 4.8, reviewCount: 87,  sales: 98,  productCount: 6  },
  { sellerAddress: 'addr6',  name: '한지호', specialty: '경영학 족보',           rating: 4.7, reviewCount: 98,  sales: 98,  productCount: 7  },
  { sellerAddress: 'addr8',  name: '윤다인', specialty: '직장인 실전 프롬프트',  rating: 4.4, reviewCount: 72,  sales: 72,  productCount: 5  },
  { sellerAddress: 'addr9',  name: '강서준', specialty: '취업 자소서',           rating: 4.6, reviewCount: 61,  sales: 61,  productCount: 4  },
  { sellerAddress: 'addr5',  name: '정하은', specialty: 'AI 입문 강의자료',      rating: 4.3, reviewCount: 56,  sales: 56,  productCount: 4  },
  { sellerAddress: 'addr4',  name: '최유리', specialty: 'IR 덱·비주얼 자료',    rating: 5.0, reviewCount: 43,  sales: 43,  productCount: 3  },
  { sellerAddress: 'addr10', name: '임지현', specialty: '논문·연구 자동화',      rating: 4.8, reviewCount: 44,  sales: 44,  productCount: 3  },
  { sellerAddress: 'addr7',  name: '오세진', specialty: '대학원·연구 가이드',    rating: 4.5, reviewCount: 31,  sales: 31,  productCount: 4  },
]

const RANK_STYLE = {
  1: { badge: 'bg-yellow-400 text-white', avatar: 'bg-yellow-50 text-yellow-600', icon: '🥇' },
  2: { badge: 'bg-gray-400 text-white',   avatar: 'bg-gray-50 text-gray-500',     icon: '🥈' },
  3: { badge: 'bg-amber-500 text-white',  avatar: 'bg-amber-50 text-amber-600',   icon: '🥉' },
}

function Stars({ value }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={11}
          className={s <= Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

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

export default function MonthlyRanking() {
  const [sort, setSort] = useState('sales')

  const ranked = [...MONTHLY_CREATORS].sort((a, b) => {
    if (sort === 'sales')   return b.sales - a.sales
    if (sort === 'reviews') return b.reviewCount - a.reviewCount
    if (sort === 'rating')  return b.rating - a.rating
    return 0
  })

  return (
    <div className="max-w-3xl mx-auto px-5 py-10">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <p className="text-xs font-semibold text-primary mb-1.5 tracking-wider uppercase">2025년 10월 기준</p>
          <h1 className="text-[26px] font-extrabold text-gray-900">이달의 크리에이터 순위</h1>
          <p className="text-sm text-gray-400 mt-1">판매량·리뷰·별점 기준 TOP 10</p>
        </div>
        <Link
          to="/creators"
          className="shrink-0 flex items-center gap-1 text-sm text-primary font-semibold border border-primary/30 hover:bg-primary/5 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          전체 크리에이터 보기
          <ArrowRight size={14} />
        </Link>
      </div>

      {/* 정렬 탭 */}
      <div className="flex items-center gap-2 mb-6 mt-5">
        {SORT_OPTIONS.map((opt) => (
          <Chip key={opt.value} active={sort === opt.value} onClick={() => setSort(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      {/* 순위 리스트 */}
      <div className="space-y-2.5">
        {ranked.map((c, i) => {
          const rank = i + 1
          const style = RANK_STYLE[rank]
          return (
            <Link
              key={c.sellerAddress}
              to={`/seller/${c.sellerAddress}`}
              className={`flex items-center gap-4 px-5 py-4 bg-white rounded-xl border transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] hover:border-primary/20 ${
                rank === 1 ? 'border-primary/30 ring-1 ring-primary/10' : 'border-surface-border'
              }`}
            >
              {/* 순위 배지 */}
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                style ? style.badge : 'bg-surface text-gray-400'
              }`}>
                {rank <= 3 ? rank : rank}
              </div>

              {/* 아바타 */}
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-base font-bold ${
                style ? style.avatar : 'bg-surface text-gray-500'
              }`}>
                {c.name[0]}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900">{c.name}</p>
                  {rank <= 3 && (
                    <span className="text-base leading-none">{style.icon}</span>
                  )}
                </div>
                <p className="text-xs text-primary font-medium truncate">{c.specialty}</p>
              </div>

              {/* 통계 */}
              <div className="hidden sm:flex items-center gap-5 text-xs text-gray-500 shrink-0">
                <div className="text-center">
                  <p className="font-bold text-gray-800 text-sm">{c.sales}</p>
                  <p className="text-gray-400">판매</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-gray-800 text-sm">{c.reviewCount}</p>
                  <p className="text-gray-400">리뷰</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5 mb-0.5">
                    <Stars value={c.rating} />
                  </div>
                  <p className="font-bold text-gray-800">{c.rating.toFixed(1)}</p>
                </div>
              </div>

              <ArrowRight size={14} className="text-gray-300 shrink-0" />
            </Link>
          )
        })}
      </div>

      {/* 하단 안내 */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-xs text-gray-400">순위는 매월 1일 기준으로 갱신됩니다.</p>
        <Link
          to="/creators"
          className="btn-primary px-6 py-2.5 text-sm flex items-center gap-1.5"
        >
          전체 크리에이터 보기
          <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Star, ArrowRight, Search, X } from 'lucide-react'

const SORT_OPTIONS = [
  { value: 'rating',   label: '별점 높은 순' },
  { value: 'reviews',  label: '리뷰 많은 순' },
  { value: 'newest',   label: '최신 등록 순' },
]

const SEARCH_SCOPES = [
  { value: 'all',       label: '전체' },
  { value: 'name',      label: '이름' },
  { value: 'bio',       label: '소개' },
  { value: 'specialty', label: '전문분야' },
]

const MOCK_CREATORS = [
  {
    sellerAddress: 'addr1',
    name: '김민준',
    specialty: 'ChatGPT 프롬프트',
    bio: 'ChatGPT 프롬프트 엔지니어링 전문가. 수능·취업·업무 자동화 분야 팩을 다수 보유합니다.',
    rating: 4.9,
    reviewCount: 134,
    sales: 134,
    productCount: 8,
    joinedAt: '2024-09-01',
  },
  {
    sellerAddress: 'addr2',
    name: '이서연',
    specialty: 'Claude 자동화',
    bio: 'Claude API 기반 업무 자동화 전문가. 논문 요약·보고서·데이터 분석 프롬프트 세트 제공.',
    rating: 4.8,
    reviewCount: 87,
    sales: 98,
    productCount: 6,
    joinedAt: '2024-10-15',
  },
  {
    sellerAddress: 'addr10',
    name: '임지현',
    specialty: '논문·연구 자동화',
    bio: 'Claude로 논문 리뷰·초안 작성을 자동화하는 연구자용 프롬프트 팩을 제공합니다.',
    rating: 4.8,
    reviewCount: 44,
    sales: 44,
    productCount: 3,
    joinedAt: '2025-09-15',
  },
  {
    sellerAddress: 'addr3',
    name: '박도윤',
    specialty: '수능·자격증 족보',
    bio: 'AI로 정리한 수능·공무원·자격증 족보 전문 제작자. 핵심 요약 + 예상문제 패키지.',
    rating: 4.7,
    reviewCount: 212,
    sales: 87,
    productCount: 5,
    joinedAt: '2024-11-01',
  },
  {
    sellerAddress: 'addr6',
    name: '한지호',
    specialty: '경영학 족보',
    bio: '경영학 전공 기말·중간 족보 AI 분석팩. 핵심 요약·예상 문제 세트로 학점 관리.',
    rating: 4.7,
    reviewCount: 98,
    sales: 98,
    productCount: 7,
    joinedAt: '2025-03-05',
  },
  {
    sellerAddress: 'addr9',
    name: '강서준',
    specialty: '취업 자소서',
    bio: '대기업 합격 후기 포함 취업 자소서 첨삭 AI 프롬프트. 실전 합격 예시 첨부.',
    rating: 4.6,
    reviewCount: 61,
    sales: 61,
    productCount: 4,
    joinedAt: '2025-07-03',
  },
  {
    sellerAddress: 'addr4',
    name: '최유리',
    specialty: 'IR 덱·비주얼 자료',
    bio: '스타트업 IR 덱 시각화 자료 + GPT 활용 인포그래픽 팩. 투자자 미팅 준비에 최적.',
    rating: 5.0,
    reviewCount: 43,
    sales: 43,
    productCount: 3,
    joinedAt: '2025-01-20',
  },
  {
    sellerAddress: 'addr8',
    name: '윤다인',
    specialty: '직장인 실전 프롬프트',
    bio: 'GPT-4o 업무 생산성 극대화 노하우. 기획서·보고서·메일 자동화 실전 가이드.',
    rating: 4.4,
    reviewCount: 72,
    sales: 72,
    productCount: 5,
    joinedAt: '2025-05-20',
  },
  {
    sellerAddress: 'addr5',
    name: '정하은',
    specialty: 'AI 입문 강의자료',
    bio: '비전공자를 위한 ChatGPT 입문 강의자료 패키지. 쉽고 빠르게 AI 도구 정복.',
    rating: 4.3,
    reviewCount: 56,
    sales: 56,
    productCount: 4,
    joinedAt: '2025-02-10',
  },
  {
    sellerAddress: 'addr7',
    name: '오세진',
    specialty: '대학원·연구 가이드',
    bio: '대학원 연구계획서 작성 가이드 + Claude 프롬프트 템플릿. 대학원 진학 준비 완성.',
    rating: 4.5,
    reviewCount: 31,
    sales: 31,
    productCount: 4,
    joinedAt: '2025-04-12',
  },
]

function Stars({ value, size = 12 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(value) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}
        />
      ))}
    </div>
  )
}

function CreatorCard({ creator, rank }) {
  return (
    <div className="bg-white border border-surface-border rounded-xl p-5 flex flex-col gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] hover:border-primary/20 transition-all">
      {/* 상단: 아바타 + 기본 정보 */}
      <div className="flex items-start gap-3.5">
        {/* 순위 + 아바타 */}
        <div className="relative shrink-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
            rank <= 3 ? 'bg-primary/10 text-primary' : 'bg-surface text-gray-500'
          }`}>
            {creator.name[0]}
          </div>
          {rank <= 3 && (
            <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
              rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-400' : 'bg-amber-500'
            }`}>
              {rank}
            </div>
          )}
        </div>

        {/* 이름 + 전문분야 */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-gray-900 truncate">{creator.name}</p>
          <p className="text-xs text-primary font-medium truncate">{creator.specialty}</p>
        </div>
      </div>

      {/* 한 줄 소개 */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{creator.bio}</p>

      {/* 통계 */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Stars value={creator.rating} />
          <span className="font-bold text-gray-800">{creator.rating.toFixed(1)}</span>
        </div>
        <span className="text-gray-200">|</span>
        <span className="text-gray-500">리뷰 <strong className="text-gray-700">{creator.reviewCount}</strong></span>
        <span className="text-gray-200">|</span>
        <span className="text-gray-500">판매 <strong className="text-gray-700">{creator.sales}</strong>건</span>
      </div>

      {/* CTA */}
      <Link
        to={`/seller/${creator.sellerAddress}`}
        className="flex items-center justify-center gap-1 w-full py-2 rounded-lg border border-surface-border text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
      >
        판매자 페이지 보기
        <ArrowRight size={13} />
      </Link>
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

export default function Creators() {
  const [sort, setSort] = useState('rating')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [searchScope, setSearchScope] = useState('all')

  const isFiltered = search !== '' || sort !== 'rating'

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleReset = () => {
    setSearch('')
    setSearchInput('')
    setSearchScope('all')
    setSort('rating')
  }

  const displayed = [...MOCK_CREATORS]
    .filter((c) => {
      if (!search) return true
      const q = search
      if (searchScope === 'all')       return c.name.includes(q) || c.bio.includes(q) || c.specialty.includes(q)
      if (searchScope === 'name')      return c.name.includes(q)
      if (searchScope === 'bio')       return c.bio.includes(q)
      if (searchScope === 'specialty') return c.specialty.includes(q)
      return true
    })
    .sort((a, b) => {
      if (sort === 'rating')  return b.rating - a.rating
      if (sort === 'reviews') return b.reviewCount - a.reviewCount
      if (sort === 'newest')  return new Date(b.joinedAt) - new Date(a.joinedAt)
      return 0
    })

  return (
    <div>
      {/* 히어로 */}
      <div className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-5 py-10 text-center">
          <p className="text-xs font-semibold text-primary mb-3 tracking-wider uppercase">AI Square Creators</p>
          <h1 className="text-[28px] md:text-[36px] font-bold text-gray-900 leading-tight mb-2">
            크리에이터
          </h1>
          <p className="text-gray-400 text-sm mb-7">검증된 AI 노하우 크리에이터들을 만나보세요</p>

          {/* 검색 범위 칩 */}
          <div className="flex items-center justify-center gap-1.5 mb-3">
            {SEARCH_SCOPES.map((s) => (
              <button
                key={s.value}
                onClick={() => setSearchScope(s.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  searchScope === s.value
                    ? 'bg-primary text-white'
                    : 'bg-surface text-gray-500 hover:text-gray-700 border border-surface-border'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 검색 바 */}
          <form onSubmit={handleSearch} className="max-w-xl mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                className="input pl-10 h-11"
                placeholder={
                  searchScope === 'all'       ? '이름, 소개, 전문분야 검색' :
                  searchScope === 'name'      ? '크리에이터 이름 검색' :
                  searchScope === 'bio'       ? '한 줄 소개 검색' :
                                               '전문분야 검색'
                }
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

      {/* 정렬 툴바 */}
      <div className="bg-white border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-2">
          {SORT_OPTIONS.map((opt) => (
            <Chip key={opt.value} active={sort === opt.value} onClick={() => setSort(opt.value)}>
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      {/* 크리에이터 그리드 */}
      <div className="max-w-6xl mx-auto px-5 py-7">
        <p className="text-sm text-gray-500 mb-5">
          {search
            ? <><span className="font-semibold text-gray-900">{displayed.length}</span>명 검색됨</>
            : <><span className="font-semibold text-gray-900">{displayed.length}</span>명의 크리에이터</>
          }
        </p>

        {displayed.length === 0 ? (
          <div className="text-center py-28">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-gray-500 font-medium mb-1">"{search}" 검색 결과가 없습니다</p>
            <p className="text-sm text-gray-400 mb-4">다른 검색어나 범위를 바꿔보세요</p>
            <button onClick={handleReset} className="text-sm text-primary hover:underline">전체 보기</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((creator, i) => (
              <CreatorCard key={creator.sellerAddress} creator={creator} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

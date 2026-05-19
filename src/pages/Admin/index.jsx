import { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Package, Users, ShieldAlert, ChevronRight } from 'lucide-react'

/* ──────────────────────── Mock Data ──────────────────────── */

const MOCK_REPORTS = [
  {
    id: 'rpt-001',
    orderId: 'ord-112',
    buyerName: '홍길동',
    sellerName: '김민준',
    productTitle: 'ChatGPT 프롬프트 마스터팩 v2',
    reportedAt: '2025-10-14 11:23',
    reason: '설명과 다른 파일 내용',
    status: 'REPORTED',
  },
  {
    id: 'rpt-002',
    orderId: 'ord-098',
    buyerName: '이민지',
    sellerName: '박도윤',
    productTitle: '수능 영어 족보 2025',
    reportedAt: '2025-10-13 09:05',
    reason: '파일 열리지 않음',
    status: 'REPORTED',
  },
  {
    id: 'rpt-003',
    orderId: 'ord-077',
    buyerName: '박준혁',
    sellerName: '이서연',
    productTitle: 'Claude 자동화 프롬프트 팩',
    reportedAt: '2025-10-10 16:44',
    reason: '중복 파일 (이미 구매한 내용)',
    status: 'REFUNDED',
  },
  {
    id: 'rpt-004',
    orderId: 'ord-065',
    buyerName: '최수진',
    sellerName: '한지호',
    productTitle: '경영학 기말 족보 패키지',
    reportedAt: '2025-10-08 14:20',
    reason: '허위 설명 (별점 조작 의심)',
    status: 'CONFIRMED',
  },
]

const MOCK_ORDERS = [
  { id: 'ord-112', buyerName: '홍길동',  sellerName: '김민준', productTitle: 'ChatGPT 프롬프트 마스터팩 v2',  amount: 12000, status: 'REPORTED',   createdAt: '2025-10-12' },
  { id: 'ord-111', buyerName: '강하준',  sellerName: '이서연', productTitle: 'Claude 자동화 프롬프트 팩',      amount: 9500,  status: 'CONFIRMED',  createdAt: '2025-10-12' },
  { id: 'ord-110', buyerName: '윤지수',  sellerName: '박도윤', productTitle: '수능 수학 족보 2025',            amount: 7000,  status: 'PENDING',    createdAt: '2025-10-13' },
  { id: 'ord-109', buyerName: '정하늘',  sellerName: '최유리', productTitle: 'IR 덱 시각화 자료',              amount: 15000, status: 'CONFIRMED',  createdAt: '2025-10-11' },
  { id: 'ord-108', buyerName: '임도현',  sellerName: '한지호', productTitle: '경영학 기말 족보 패키지',        amount: 8000,  status: 'REFUNDED',   createdAt: '2025-10-09' },
  { id: 'ord-107', buyerName: '이민지',  sellerName: '박도윤', productTitle: '수능 영어 족보 2025',            amount: 6000,  status: 'REPORTED',   createdAt: '2025-10-13' },
  { id: 'ord-106', buyerName: '김보람',  sellerName: '정하은', productTitle: 'AI 입문 강의자료 세트',          amount: 5500,  status: 'PENDING',    createdAt: '2025-10-14' },
  { id: 'ord-105', buyerName: '오승민',  sellerName: '윤다인', productTitle: '직장인 GPT 활용 가이드',         amount: 11000, status: 'CONFIRMED',  createdAt: '2025-10-10' },
]

const MOCK_USERS = [
  { id: 'u-01', name: '김민준',  email: 'kim@example.com',  tokenPct: 87, sales: 134, joinedAt: '2024-09-01', role: 'seller' },
  { id: 'u-02', name: '이서연',  email: 'lee@example.com',  tokenPct: 72, sales: 98,  joinedAt: '2024-10-15', role: 'seller' },
  { id: 'u-03', name: '박도윤',  email: 'park@example.com', tokenPct: 60, sales: 87,  joinedAt: '2024-11-01', role: 'seller' },
  { id: 'u-04', name: '홍길동',  email: 'hong@example.com', tokenPct: 10, sales: 0,   joinedAt: '2025-09-20', role: 'buyer'  },
  { id: 'u-05', name: '한지호',  email: 'han@example.com',  tokenPct: 45, sales: 98,  joinedAt: '2025-03-05', role: 'seller' },
  { id: 'u-06', name: '최유리',  email: 'choi@example.com', tokenPct: 93, sales: 43,  joinedAt: '2025-01-20', role: 'seller' },
  { id: 'u-07', name: '윤다인',  email: 'yoon@example.com', tokenPct: 55, sales: 72,  joinedAt: '2025-05-20', role: 'seller' },
  { id: 'u-08', name: '강서준',  email: 'kang@example.com', tokenPct: 68, sales: 61,  joinedAt: '2025-07-03', role: 'seller' },
]

/* ──────────────────────── Helpers ──────────────────────── */

const STATUS_STYLE = {
  PENDING:   { label: '대기중',   className: 'bg-yellow-50 text-yellow-700 border-yellow-200'  },
  CONFIRMED: { label: '정산완료', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REPORTED:  { label: '신고접수', className: 'bg-red-50 text-red-600 border-red-200'            },
  REFUNDED:  { label: '환불완료', className: 'bg-gray-100 text-gray-500 border-gray-200'        },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] ?? { label: status, className: 'bg-gray-100 text-gray-500 border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.className}`}>
      {s.label}
    </span>
  )
}

function TokenBar({ pct }) {
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
        {pct}%
      </span>
    </div>
  )
}

/* ──────────────────────── Tab: 신고 관리 ──────────────────────── */

function ReportsTab() {
  const [reports, setReports] = useState(MOCK_REPORTS)
  const [filter, setFilter] = useState('REPORTED')

  const handleAction = (id, action) => {
    setReports((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: action === 'approve' ? 'REFUNDED' : 'CONFIRMED' } : r)
    )
  }

  const pending  = reports.filter((r) => r.status === 'REPORTED').length
  const resolved = reports.filter((r) => r.status !== 'REPORTED').length

  const displayed = filter === 'ALL' ? reports : reports.filter((r) => r.status === filter)

  return (
    <div>
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">미처리 신고</p>
          <p className="text-2xl font-extrabold text-red-500">{pending}</p>
        </div>
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">처리 완료</p>
          <p className="text-2xl font-extrabold text-gray-700">{resolved}</p>
        </div>
        <div className="bg-white border border-surface-border rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">전체</p>
          <p className="text-2xl font-extrabold text-gray-700">{reports.length}</p>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {[['REPORTED', '미처리'], ['REFUNDED', '환불완료'], ['CONFIRMED', '신고기각'], ['ALL', '전체']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === val ? 'bg-primary text-white' : 'bg-white text-gray-500 border border-surface-border hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-20 text-gray-400 text-sm">해당 항목이 없습니다.</div>
        )}
        {displayed.map((r) => (
          <div key={r.id} className="bg-white border border-surface-border rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-gray-400">{r.reportedAt}</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-gray-400">주문 {r.orderId}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 truncate mb-0.5">{r.productTitle}</p>
                <p className="text-xs text-gray-500">
                  구매자 <span className="font-semibold text-gray-700">{r.buyerName}</span>
                  <span className="mx-1 text-gray-300">→</span>
                  판매자 <span className="font-semibold text-gray-700">{r.sellerName}</span>
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-gray-600">{r.reason}</p>
                </div>
              </div>

              {r.status === 'REPORTED' && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleAction(r.id, 'approve')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-semibold border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    <CheckCircle size={14} />
                    신고 인정 (환불)
                  </button>
                  <button
                    onClick={() => handleAction(r.id, 'reject')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-semibold border border-emerald-200 hover:bg-emerald-100 transition-colors"
                  >
                    <XCircle size={14} />
                    신고 기각 (정산)
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────── Tab: 주문 현황 ──────────────────────── */

function OrdersTab() {
  const [filter, setFilter] = useState('ALL')

  const counts = MOCK_ORDERS.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1
    return acc
  }, {})

  const displayed = filter === 'ALL' ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === filter)

  const statCards = [
    { label: '전체',    status: 'ALL',       count: MOCK_ORDERS.length, color: 'text-gray-800' },
    { label: '대기중',  status: 'PENDING',    count: counts.PENDING ?? 0,   color: 'text-yellow-600' },
    { label: '정산완료',status: 'CONFIRMED',  count: counts.CONFIRMED ?? 0, color: 'text-emerald-600' },
    { label: '신고접수',status: 'REPORTED',   count: counts.REPORTED ?? 0,  color: 'text-red-500' },
    { label: '환불완료',status: 'REFUNDED',   count: counts.REFUNDED ?? 0,  color: 'text-gray-500' },
  ]

  return (
    <div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {statCards.map((c) => (
          <button
            key={c.status}
            onClick={() => setFilter(c.status)}
            className={`bg-white border rounded-xl p-4 text-left transition-all ${
              filter === c.status ? 'border-primary ring-1 ring-primary/20' : 'border-surface-border hover:border-gray-300'
            }`}
          >
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-2xl font-extrabold ${c.color}`}>{c.count}</p>
          </button>
        ))}
      </div>

      {/* 주문 테이블 */}
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface text-xs text-gray-500">
                <th className="text-left px-5 py-3 font-semibold">주문 ID</th>
                <th className="text-left px-4 py-3 font-semibold">상품</th>
                <th className="text-left px-4 py-3 font-semibold">구매자</th>
                <th className="text-left px-4 py-3 font-semibold">판매자</th>
                <th className="text-right px-4 py-3 font-semibold">금액</th>
                <th className="text-center px-4 py-3 font-semibold">상태</th>
                <th className="text-left px-4 py-3 font-semibold">날짜</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {displayed.map((o) => (
                <tr key={o.id} className="hover:bg-surface/60 transition-colors">
                  <td className="px-5 py-3.5 text-xs text-gray-400 font-mono">{o.id}</td>
                  <td className="px-4 py-3.5 max-w-[200px]">
                    <p className="truncate text-gray-800 font-medium text-xs">{o.productTitle}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-600">{o.buyerName}</td>
                  <td className="px-4 py-3.5 text-xs text-gray-600">{o.sellerName}</td>
                  <td className="px-4 py-3.5 text-right text-xs font-semibold text-gray-800">
                    {o.amount.toLocaleString()}원
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{o.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {displayed.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">해당 항목이 없습니다.</div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────── Tab: 사용자 관리 ──────────────────────── */

function UsersTab() {
  const [users, setUsers] = useState(MOCK_USERS)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')

  const startEdit = (u) => {
    setEditing(u.id)
    setEditVal(String(u.tokenPct))
  }

  const saveEdit = (id) => {
    const parsed = Math.min(100, Math.max(0, parseInt(editVal, 10) || 0))
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, tokenPct: parsed } : u))
    setEditing(null)
  }

  return (
    <div>
      <div className="bg-white border border-surface-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface text-xs text-gray-500">
                <th className="text-left px-5 py-3 font-semibold">사용자</th>
                <th className="text-left px-4 py-3 font-semibold">이메일</th>
                <th className="text-center px-4 py-3 font-semibold">역할</th>
                <th className="text-right px-4 py-3 font-semibold">판매수</th>
                <th className="text-left px-4 py-3 font-semibold min-w-[180px]">토큰 퍼센테이지</th>
                <th className="text-left px-4 py-3 font-semibold">가입일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-surface/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {u.name[0]}
                      </div>
                      <span className="text-sm font-semibold text-gray-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">{u.email}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      u.role === 'seller'
                        ? 'bg-primary/5 text-primary border-primary/20'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                      {u.role === 'seller' ? '판매자' : '구매자'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-semibold text-gray-700">{u.sales}</td>
                  <td className="px-4 py-3.5">
                    {editing === u.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          className="w-16 h-7 px-2 text-xs rounded border border-primary/40 focus:outline-none focus:border-primary text-center font-bold"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(u.id)}
                        />
                        <span className="text-xs text-gray-400">%</span>
                        <button onClick={() => saveEdit(u.id)} className="text-xs text-primary font-semibold hover:underline">저장</button>
                        <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:underline">취소</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <TokenBar pct={u.tokenPct} />
                        <button
                          onClick={() => startEdit(u)}
                          className="text-[11px] text-gray-300 group-hover:text-primary transition-colors font-semibold shrink-0"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{u.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────── Main ──────────────────────── */

const TABS = [
  { id: 'reports', label: '신고 관리',   Icon: ShieldAlert },
  { id: 'orders',  label: '주문 현황',   Icon: Package     },
  { id: 'users',   label: '사용자 관리', Icon: Users       },
]

export default function Admin() {
  const [tab, setTab] = useState('reports')

  return (
    <div className="max-w-5xl mx-auto px-5 py-10">
      {/* 헤더 */}
      <div className="mb-7">
        <p className="text-xs font-semibold text-primary mb-1.5 tracking-wider uppercase">Admin</p>
        <h1 className="text-[26px] font-extrabold text-gray-900">관리자 페이지</h1>
        <p className="text-sm text-gray-400 mt-1">신고 처리 · 주문 모니터링 · 사용자 토큰 관리</p>
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 border-b border-surface-border mb-7">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              tab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'orders'  && <OrdersTab />}
      {tab === 'users'   && <UsersTab />}
    </div>
  )
}

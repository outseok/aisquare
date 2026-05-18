export default function TokenBadge({ pct, size = 'md' }) {
  if (pct == null) return null

  const color =
    pct >= 70 ? 'text-green-400' :
    pct >= 40 ? 'text-yellow-400' :
    'text-red-400'

  const barColor =
    pct >= 70 ? 'bg-green-500' :
    pct >= 40 ? 'bg-yellow-500' :
    'bg-red-500'

  const label = pct >= 70 ? '우수' : pct >= 40 ? '보통' : '주의'

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-16 bg-surface-border rounded-full h-1.5">
          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs font-semibold ${color}`}>{pct}%</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">토큰 퍼센테이지</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            pct >= 70 ? 'bg-green-500/10 text-green-400' :
            pct >= 40 ? 'bg-yellow-500/10 text-yellow-400' :
            'bg-red-500/10 text-red-400'
          }`}>{label}</span>
          <span className={`text-sm font-bold ${color}`}>{pct}%</span>
        </div>
      </div>
      <div className="w-full bg-surface-border rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-600">
        구매 확정 시 상승 · 신고 인정 시 하락 · 범위 0–100%
      </p>
    </div>
  )
}

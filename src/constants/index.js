// Square Wallet (충전·결제·정산)
export const SQUARE_POLICY = {
  KRW_PER_SQUARE: 1.1,          // 충전 시 1 Square = 1.1원 (수수료 10% 포함)
  MIN_CHARGE: 5000,              // 최소 충전: 5,000 Square = 5,500원
  CHARGE_UNIT: 1000,             // 충전 단위: 1,000 Square = 1,100원
  PLATFORM_FEE_RATE: 0.1,       // 거래 수수료 10%
  BUYER_CASHBACK_RATE: 0.02,    // 구매 확정 캐시백 (구매자) → Point Wallet
  SELLER_CASHBACK_RATE: 0.02,   // 구매 확정 캐시백 (판매자) → Point Wallet
}

// Point Wallet (보너스·할인 전용, 출금 불가)
export const POINT_POLICY = {
  CHARGE_POINT_RATE: 0.001,     // 충전 KRW의 0.1% → Point 자동 적립 (1,000원당 1 Point)
  REVIEW_REWARD: 100,            // 리뷰 작성 보상
}

export const ALLOWED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'video/mp4': ['.mp4'],
  'application/zip': ['.zip'],
  'text/plain': ['.txt'],
}

export const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REPORTED: 'REPORTED',
  REFUNDED: 'REFUNDED',
}

export const ORDER_STATUS_LABEL = {
  PENDING: '구매 확정 대기',
  CONFIRMED: '구매 확정',
  REPORTED: '신고 접수됨',
  REFUNDED: '환불 완료',
}

// 외부 포인트 연동 파트너 (Hyperledger Fabric 멀티 조직)
export const EXCHANGE_PARTNERS = [
  { id: 'naver', name: '네이버페이', short: 'N', bg: 'bg-[#03C75A]', text: 'text-white',     rateIn: 0.9,  rateOut: 0.9  },
  { id: 'kakao', name: '카카오페이', short: 'K', bg: 'bg-[#FFCD00]', text: 'text-gray-900',  rateIn: 0.9,  rateOut: 0.9  },
  { id: 'toss',  name: '토스페이',  short: 'T', bg: 'bg-[#0064FF]', text: 'text-white',     rateIn: 0.95, rateOut: 0.95 },
  { id: 'ssg',   name: 'SSG페이',   short: 'S', bg: 'bg-[#E3001B]', text: 'text-white',     rateIn: 0.88, rateOut: 0.88 },
]

export const EXCHANGE_STATUS_CONFIG = {
  PENDING:   { label: 'Fabric 서명 대기', className: 'bg-yellow-500/10 text-yellow-400' },
  COMPLETED: { label: '전환 완료',        className: 'bg-green-500/10  text-green-400'  },
  FAILED:    { label: '전환 실패',        className: 'bg-red-500/10    text-red-400'    },
}

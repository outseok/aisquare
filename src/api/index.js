import axios from 'axios'
import toast from 'react-hot-toast'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// 요청 인터셉터: PASS 인증 세션 쿠키는 withCredentials로 자동 전송
api.interceptors.request.use((config) => {
  config.withCredentials = true
  return config
})

// 응답 인터셉터: 공통 에러 처리
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.message ?? '서버 오류가 발생했습니다.'
    if (err.response?.status !== 401) toast.error(msg)
    return Promise.reject(err)
  }
)

// ── 회원가입 / 로그인 ────────────────────────────────────────────────────────
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
}

// ── 유저 ──────────────────────────────────────────────────────────────────
export const userApi = {
  getMe: () => api.get('/users/me'),
  updateProfile: (data) => api.patch('/users/me', data),
}

// ── PASS 본인인증 ─────────────────────────────────────────────────────────
export const passApi = {
  init: () => api.post('/auth/pass/init'),
  verify: (code, sessionId) => api.post('/auth/pass/verify', { code, sessionId }),
}

// ── Square Wallet ────────────────────────────────────────────────────────────
export const squareApi = {
  getBalance: () => api.get('/wallet/square/balance'),
  getHistory: (params) => api.get('/wallet/square/history', { params }),
  charge: (squareAmount) => api.post('/wallet/square/charge', { squareAmount }),
}

// ── Point Wallet ─────────────────────────────────────────────────────────────
export const pointApi = {
  getBalance: () => api.get('/wallet/point/balance'),
  getHistory: (params) => api.get('/wallet/point/history', { params }),
}

// ── 상품 ────────────────────────────────────────────────────────────────────
export const productApi = {
  getList: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.patch(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  toggleVisibility: (id) => api.patch(`/products/${id}/visibility`),
  uploadFile: (formData) =>
    api.post('/products/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 500MB 업로드 고려
    }),
}

// ── 찜 ──────────────────────────────────────────────────────────────────────
export const wishlistApi = {
  getList: () => api.get('/wishlists'),
  remove: (productId) => api.delete(`/wishlists/${productId}`),
}

// ── 장바구니 ─────────────────────────────────────────────────────────────────
export const cartApi = {
  getList: () => api.get('/cart'),
  remove: (productId) => api.delete(`/cart/${productId}`),
}

// ── 주문 ────────────────────────────────────────────────────────────────────
export const orderApi = {
  getList: () => api.get('/orders'),
  create: (productId, paymentMethod) =>
    api.post('/orders', { productId, paymentMethod }),
  confirm: (orderId) => api.post(`/orders/${orderId}/confirm`),
  getDownloadUrl: (orderId) => api.get(`/orders/${orderId}/download`),
}

// ── 리뷰 ────────────────────────────────────────────────────────────────────
export const reviewApi = {
  create: (orderId, data) => api.post('/reviews', { orderId, ...data }),
  getBySeller: (address) => api.get(`/sellers/${address}/reviews`),
}

// ── 신고 ────────────────────────────────────────────────────────────────────
export const reportApi = {
  create: (formData) =>
    api.post('/reports', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
}

// ── 판매자 ──────────────────────────────────────────────────────────────────
export const sellerApi = {
  getProfile: (address) => api.get(`/sellers/${address}`),
  updateProfile: (data) => api.patch('/sellers/me', data),
  getProducts: (address, params) => api.get(`/sellers/${address}/products`, { params }),
}

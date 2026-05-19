import { create } from 'zustand'
import { cartApi, wishlistApi } from '../api'

export const useCartWishlistStore = create((set) => ({
  cartCount: 0,
  wishlistCount: 0,

  fetchCounts: async () => {
    try {
      const [cartRes, wishRes] = await Promise.all([
        cartApi.getList(),
        wishlistApi.getList(),
      ])
      set({
        cartCount: (cartRes.data ?? []).length,
        wishlistCount: (wishRes.data ?? []).length,
      })
    } catch {
      // 비로그인 등 무시
    }
  },

  incrementCart: () => set((s) => ({ cartCount: s.cartCount + 1 })),
  decrementCart: () => set((s) => ({ cartCount: Math.max(0, s.cartCount - 1) })),
  incrementWishlist: () => set((s) => ({ wishlistCount: s.wishlistCount + 1 })),
  decrementWishlist: () => set((s) => ({ wishlistCount: Math.max(0, s.wishlistCount - 1) })),
  resetCounts: () => set({ cartCount: 0, wishlistCount: 0 }),
}))

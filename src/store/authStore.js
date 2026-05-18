import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set) => ({
      // ── 로그인 상태 (아이디/비밀번호) ─────────────────────────────────
      isLoggedIn: false,
      user: null, // { id, username, name, nickname, email }

      setUser: (user) => set({ isLoggedIn: true, user }),

      logout: () =>
        set({
          isLoggedIn: false,
          user: null,
          isPassVerified: false,
          passName: null,
          passVerifiedAt: null,
        }),

      // ── PASS 본인인증 상태 (구매·판매 시 추가 인증) ─────────────────
      isPassVerified: false,
      passName: null,
      passPhone: null,
      passVerifiedAt: null,

      setPassVerified: ({ passName, passPhone }) =>
        set({
          isPassVerified: true,
          passName,
          passPhone: passPhone ?? null,
          passVerifiedAt: new Date().toISOString(),
        }),

      clearPass: () =>
        set({ isPassVerified: false, passName: null, passPhone: null, passVerifiedAt: null }),

      updateUser: (patch) =>
        set((state) => ({ user: { ...state.user, ...patch } })),
    }),
    { name: 'recode-auth' }
  )
)

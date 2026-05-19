import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function AdminRoute({ children }) {
  const { isLoggedIn, user, _hasHydrated } = useAuthStore()

  if (!_hasHydrated) return null

  if (!isLoggedIn || user?.role !== 'ADMIN') {
    return <Navigate to="/admin/login" replace />
  }

  return children
}

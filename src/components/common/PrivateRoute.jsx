import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function PrivateRoute({ children }) {
  const { isLoggedIn, _hasHydrated } = useAuthStore()

  if (!_hasHydrated) return null

  return isLoggedIn ? children : <Navigate to="/login" replace />
}

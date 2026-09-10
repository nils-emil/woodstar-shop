import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { admin, isApiError } from '@/api/client'
import { PageSpinner } from '@/components/Spinner'

interface AuthValue {
  username: string | null
  loading: boolean
  login: (u: string, p: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await admin.me()
      setUsername(me.username)
    } catch (e) {
      if (isApiError(e) && (e.status === 401 || e.status === 403)) setUsername(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (u: string, p: string) => {
    const me = await admin.login(u, p)
    setUsername(me.username)
  }, [])

  const logout = useCallback(async () => {
    try {
      await admin.logout()
    } finally {
      setUsername(null)
    }
  }, [])

  return <AuthContext.Provider value={{ username, loading, login, logout, refresh }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { username, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageSpinner />
  if (!username) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../api/client'

export interface AuthRole {
  role_id: number
  role_code: string
  role_name: string
}

export interface AuthUser {
  user_id: number
  full_name: string
  email: string | null
  active: boolean
  role_id: number | null
  role: AuthRole | null
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  reload: () => Promise<void>
  hasRole: (...codes: string[]) => boolean
  isAdmin: () => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    try {
      const res = await api.get<AuthUser>('/api/auth/me')
      setUser(res.data)
    } catch {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      setUser(null)
    }
  }

  useEffect(() => {
    if (localStorage.getItem(ACCESS_KEY)) {
      loadProfile().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; refresh_token: string }>(
      '/api/auth/login',
      { email, password },
    )
    localStorage.setItem(ACCESS_KEY, res.data.access_token)
    localStorage.setItem(REFRESH_KEY, res.data.refresh_token)
    await loadProfile()
  }

  const logout = () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    setUser(null)
  }

  const hasRole = (...codes: string[]) =>
    !!user?.role?.role_code && codes.includes(user.role.role_code)

  const isAdmin = () => hasRole('admin')

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        reload: loadProfile,
        hasRole,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

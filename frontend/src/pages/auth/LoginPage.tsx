import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { FlaskConical } from 'lucide-react'
import { AxiosError } from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import PasswordInput from '../../components/PasswordInput'

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return null
  if (isAuthenticated) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      const from = (location.state as { from?: string })?.from ?? '/'
      navigate(from, { replace: true })
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>
      setError(ax.response?.data?.detail ?? 'Error al iniciar sesión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cea-50 to-cea-100 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 rounded-2xl bg-cea-900 p-3 text-white">
            <FlaskConical className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">CEA EXPORT</h1>
          <p className="text-xs text-slate-500">Control de calidad — materia prima</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
            />
          </div>

          <PasswordInput
            label="Contraseña"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full rounded-xl bg-cea-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cea-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}

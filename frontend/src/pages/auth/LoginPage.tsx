import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, ShieldCheck } from 'lucide-react'
import { AxiosError } from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import PasswordInput from '../../components/PasswordInput'
import ceaLogo from '../../assets/cea-logo.jpeg'

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
      setError(ax.response?.data?.detail ?? 'Email o contraseña incorrectos')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* ── Panel izquierdo: branding ────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-cea-900 p-10 text-white lg:flex lg:w-1/2 xl:w-2/5">
        {/* Decoración de fondo */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cea-700/40 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-amber-500/20 blur-3xl" />
        </div>

        {/* Top: logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img
            src={ceaLogo}
            alt="CEA EXPORT"
            className="h-12 w-12 rounded-lg object-cover shadow-lg ring-2 ring-white/20"
          />
          <div>
            <p className="text-lg font-semibold tracking-tight">CEA EXPORT</p>
            <p className="text-xs text-cea-200">Premium Ecuadorian Shrimp</p>
          </div>
        </div>

        {/* Centro: tagline */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Control de calidad de materia prima
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-cea-200">
            Trazabilidad y análisis sensorial de cada lote, desde la recepción
            del camión hasta la liberación a producción.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-cea-100">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">•</span>
              R-CC-001 análisis organoléptico
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">•</span>
              R-CC-034 histograma de clasificación
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-300">•</span>
              Dashboard de proveedores y tendencias
            </li>
          </ul>
        </div>

        {/* Bottom: footer corporativo */}
        <div className="relative z-10 text-xs text-cea-300">
          <p>Quality from Ecuador to the world</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} CEA EXPORT S.A. — Todos los derechos reservados.</p>
        </div>
      </aside>

      {/* ── Panel derecho: formulario ────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-sm">
          {/* Logo solo móvil/tablet (en desktop ya está en el aside) */}
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <img
              src={ceaLogo}
              alt="CEA EXPORT"
              className="h-14 w-14 rounded-xl object-cover shadow-md"
            />
            <p className="mt-3 text-lg font-semibold text-slate-900">CEA EXPORT</p>
            <p className="text-xs text-slate-500">Control de calidad — materia prima</p>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-slate-900">Bienvenido</h1>
            <p className="mt-1 text-sm text-slate-500">
              Ingresa con tus credenciales corporativas para continuar.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@ceaexport.com.ec"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  inputClassName="pl-9"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-cea-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cea-800 focus:outline-none focus:ring-2 focus:ring-cea-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Verificando…
                </>
              ) : (
                'Ingresar'
              )}
            </button>
          </form>

          {/* Pie con info de soporte y trust signal */}
          <div className="mt-8 space-y-3 text-center">
            <p className="text-xs text-slate-500">
              ¿Problemas para acceder? Contacta con tu administrador.
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Conexión segura · sesión cifrada</span>
            </div>
          </div>

          <p className="mt-10 text-center text-[11px] text-slate-400 lg:hidden">
            &copy; {new Date().getFullYear()} CEA EXPORT S.A.
          </p>
        </div>
      </main>
    </div>
  )
}

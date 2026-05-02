import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  Mail, Lock, AlertCircle, ShieldCheck, ArrowRight,
  ClipboardCheck, BarChart3, FileSearch, Lightbulb,
} from 'lucide-react'
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
  const [remember, setRemember] = useState(true)
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

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault()
    alert(
      'Para recuperar tu contraseña, contacta con el administrador del sistema. ' +
      'Él puede generar un enlace de reseteo desde la sección de usuarios.',
    )
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* ── Panel izquierdo: hero ───────────────────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-cea-950 via-cea-900 to-cea-800 p-10 text-white lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Decoración de fondo: blobs + dotted pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-cea-600/30 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-[500px] w-[500px] rounded-full bg-amber-500/15 blur-3xl" />
          {/* Dotted pattern arriba a la derecha */}
          <svg
            className="absolute right-8 top-8 opacity-10"
            width="180" height="120" viewBox="0 0 180 120" fill="none"
          >
            {Array.from({ length: 9 }).map((_, row) =>
              Array.from({ length: 13 }).map((_, col) => (
                <circle
                  key={`${row}-${col}`}
                  cx={col * 14 + 4}
                  cy={row * 14 + 4}
                  r={2}
                  fill="white"
                />
              )),
            )}
          </svg>
          {/* Camarón silueta grande SVG decorativo */}
          <svg
            className="absolute bottom-20 right-10 opacity-[0.07]"
            width="320" height="320" viewBox="0 0 100 100" fill="white"
          >
            <path d="M85 35c-3-8-12-12-20-10l-25 5c-8 2-15 8-18 16-3 9 1 19 9 24l8 5c4 2 9 1 12-2l4-4c2-2 5-3 8-3l8 1c8 1 15-3 17-11s1-15-3-21z M30 55c-2 2-2 5 0 7s5 2 7 0 2-5 0-7-5-2-7 0z" />
          </svg>
        </div>

        {/* Top: logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="rounded-xl bg-white/10 p-2 ring-1 ring-white/20">
            <img
              src={ceaLogo}
              alt="CEA EXPORT"
              className="h-12 w-12 rounded-lg object-cover"
            />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">CEA EXPORT</p>
            <p className="text-xs text-cea-200">Control de Calidad</p>
          </div>
        </div>

        {/* Centro: tagline + features */}
        <div className="relative z-10 max-w-lg">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Control inteligente.
            <br />
            Calidad que se puede{' '}
            <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              medir.
            </span>
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-cea-100">
            Plataforma integral para la recepción, análisis y liberación de
            materia prima con trazabilidad total y decisiones basadas en datos.
          </p>

          {/* Features (4 con icono cuadrado) */}
          <ul className="mt-8 space-y-4">
            <Feature
              icon={ClipboardCheck}
              title="Análisis organoléptico estructurado"
              detail="Evaluaciones precisas y estandarizadas"
            />
            <Feature
              icon={BarChart3}
              title="Control de defectos automatizado"
              detail="Muestreos y cálculos en tiempo real"
            />
            <Feature
              icon={FileSearch}
              title="Trazabilidad completa por lote"
              detail="Historial, documentos y evidencia"
            />
            <Feature
              icon={Lightbulb}
              title="Decisiones basadas en datos"
              detail="Indicadores de calidad y alertas inteligentes"
            />
          </ul>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-[11px] text-cea-300">
            &copy; {new Date().getFullYear()} CEA EXPORT S.A. — Todos los
            derechos reservados.
          </p>
        </div>
      </aside>

      {/* ── Panel derecho: formulario ───────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10 sm:px-6 lg:px-12">
        <div className="w-full max-w-md">
          {/* Logo solo móvil/tablet (en desktop ya está en el aside) */}
          <div className="mb-6 flex flex-col items-center lg:hidden">
            <img
              src={ceaLogo}
              alt="CEA EXPORT"
              className="h-14 w-14 rounded-xl object-cover shadow-md"
            />
            <p className="mt-3 text-lg font-bold text-slate-900">CEA EXPORT</p>
            <p className="text-xs text-slate-500">Control de Calidad</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
            {/* Icono escudo */}
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-cea-50 p-3 ring-1 ring-cea-100">
                <ShieldCheck className="h-7 w-7 text-cea-700" strokeWidth={2} />
              </div>
            </div>

            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Bienvenido
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Ingresa con tus credenciales corporativas para continuar.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
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
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Contraseña
                </label>
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

              {/* Remember + forgot */}
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cea-700 focus:ring-cea-500"
                  />
                  Recordar mi sesión
                </label>
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
                className="group flex w-full items-center justify-center gap-2 rounded-lg bg-cea-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cea-800 focus:outline-none focus:ring-2 focus:ring-cea-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
                  <>
                    Ingresar
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-cea-700 hover:text-cea-800 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>

            {/* Trust signal con divisor */}
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                <Lock className="h-3.5 w-3.5" />
                <span className="font-medium">Conexión segura</span>
              </div>
              <p className="mt-1 text-center text-[11px] text-slate-400">
                Tu información está protegida con cifrado de extremo a extremo.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400 lg:hidden">
            &copy; {new Date().getFullYear()} CEA EXPORT S.A.
          </p>
        </div>
      </main>
    </div>
  )
}

// ─── helpers ───

function Feature({
  icon: Icon, title, detail,
}: {
  icon: typeof ClipboardCheck
  title: string
  detail: string
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="shrink-0 rounded-lg bg-white/10 p-2 ring-1 ring-white/15 backdrop-blur-sm">
        <Icon className="h-4 w-4 text-amber-300" strokeWidth={2} />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-cea-200">{detail}</p>
      </div>
    </li>
  )
}

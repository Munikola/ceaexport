import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AxiosError } from 'axios'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../../api/client'
import PasswordInput, { isPasswordStrong } from '../../components/PasswordInput'

interface InvitationInfo {
  email: string
  full_name: string | null
  role_name: string
}

export default function AcceptInvitation() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [info, setInfo] = useState<InvitationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    api
      .get<InvitationInfo>(`/api/public/invitations/${token}`)
      .then((res) => {
        setInfo(res.data)
        if (res.data.full_name) setFullName(res.data.full_name)
      })
      .catch((err: AxiosError<{ detail?: string }>) => {
        setError(err.response?.data?.detail ?? 'Invitación no válida')
      })
      .finally(() => setLoading(false))
  }, [token])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (!isPasswordStrong(password)) {
      setError('La contraseña no cumple los requisitos')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.post<{ access_token: string; refresh_token: string }>(
        `/api/public/invitations/${token}/accept`,
        { full_name: fullName, password },
      )
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      setSuccess(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>
      setError(ax.response?.data?.detail ?? 'Error aceptando la invitación')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <CenteredCard>Cargando…</CenteredCard>
  if (error && !info)
    return (
      <CenteredCard>
        <p className="text-sm text-red-600">{error}</p>
      </CenteredCard>
    )
  if (success)
    return (
      <CenteredCard>
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <p className="text-sm text-slate-700">Cuenta creada. Entrando…</p>
      </CenteredCard>
    )

  return (
    <CenteredCard>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Crear tu cuenta</h1>
      <p className="mb-5 text-sm text-slate-500">
        Te invitaron a CEA EXPORT como <strong>{info?.role_name}</strong>.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={info?.email ?? ''}
            disabled
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nombre completo</label>
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
          />
        </div>

        <PasswordInput
          label="Contraseña"
          value={password}
          onChange={setPassword}
          showRules
        />

        <PasswordInput label="Confirmar contraseña" value={confirm} onChange={setConfirm} />

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-cea-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cea-800 disabled:bg-slate-300"
        >
          {submitting ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </CenteredCard>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cea-50 to-cea-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">{children}</div>
    </div>
  )
}

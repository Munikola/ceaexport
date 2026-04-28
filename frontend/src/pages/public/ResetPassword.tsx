import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AxiosError } from 'axios'
import { CheckCircle2 } from 'lucide-react'
import { api } from '../../api/client'
import PasswordInput, { isPasswordStrong } from '../../components/PasswordInput'

interface ResetInfo {
  full_name: string
}

export default function ResetPassword() {
  const { token = '' } = useParams()
  const [info, setInfo] = useState<ResetInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    api
      .get<ResetInfo>(`/api/public/reset/${token}`)
      .then((res) => setInfo(res.data))
      .catch((err: AxiosError<{ detail?: string }>) => {
        setError(err.response?.data?.detail ?? 'Enlace no válido')
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
      await api.post(`/api/public/reset/${token}`, { password })
      setSuccess(true)
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>
      setError(ax.response?.data?.detail ?? 'Error al actualizar contraseña')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Card>Cargando…</Card>
  if (error && !info)
    return (
      <Card>
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    )
  if (success)
    return (
      <Card>
        <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
        <p className="mb-4 text-sm text-slate-700">Contraseña actualizada.</p>
        <Link
          to="/login"
          className="inline-block rounded-xl bg-cea-700 px-4 py-2 text-sm font-medium text-white hover:bg-cea-800"
        >
          Ir al login
        </Link>
      </Card>
    )

  return (
    <Card>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Nueva contraseña</h1>
      <p className="mb-5 text-sm text-slate-500">Hola {info?.full_name}, define una contraseña nueva.</p>

      <form onSubmit={submit} className="space-y-4">
        <PasswordInput label="Nueva contraseña" value={password} onChange={setPassword} showRules />
        <PasswordInput label="Confirmar contraseña" value={confirm} onChange={setConfirm} />

        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-cea-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-cea-800 disabled:bg-slate-300"
        >
          {submitting ? 'Guardando…' : 'Actualizar contraseña'}
        </button>
      </form>
    </Card>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cea-50 to-cea-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {children}
      </div>
    </div>
  )
}

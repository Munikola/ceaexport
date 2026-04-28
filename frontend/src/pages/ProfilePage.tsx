import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import PasswordInput, { isPasswordStrong } from '../components/PasswordInput'

export default function ProfilePage() {
  const { user, reload, logout } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)
  const [pwdMsg, setPwdMsg] = useState<string | null>(null)
  const [pwdErr, setPwdErr] = useState<string | null>(null)

  if (!user) return null

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setProfileMsg(null)
    setProfileErr(null)
    setSavingProfile(true)
    try {
      await api.patch('/api/auth/me', { full_name: fullName, email })
      await reload()
      setProfileMsg('Perfil actualizado')
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>
      setProfileErr(ax.response?.data?.detail ?? 'Error al actualizar')
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwdMsg(null)
    setPwdErr(null)
    if (password !== confirm) {
      setPwdErr('Las contraseñas no coinciden')
      return
    }
    if (!isPasswordStrong(password)) {
      setPwdErr('La contraseña no cumple los requisitos')
      return
    }
    setSavingPwd(true)
    try {
      await api.patch('/api/auth/me', { password })
      setPwdMsg('Contraseña actualizada')
      setPassword('')
      setConfirm('')
    } catch (err) {
      const ax = err as AxiosError<{ detail?: string }>
      setPwdErr(ax.response?.data?.detail ?? 'Error al actualizar')
    } finally {
      setSavingPwd(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="text-sm text-slate-600 hover:text-red-600"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Mi perfil</h1>

        {/* Datos personales */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cea-700 text-white">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-slate-900">{user.full_name}</p>
              <p className="text-xs text-slate-500">
                {user.role?.role_name ?? 'sin rol'} · {user.email ?? '—'}
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
              />
            </div>
            {profileMsg && <p className="text-xs text-emerald-600">{profileMsg}</p>}
            {profileErr && <p className="text-xs text-red-600">{profileErr}</p>}
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-cea-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cea-800 disabled:bg-slate-300"
            >
              {savingProfile ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </form>
        </section>

        {/* Cambiar password */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Cambiar contraseña</h2>
          <form onSubmit={savePassword} className="space-y-3">
            <PasswordInput
              label="Nueva contraseña"
              value={password}
              onChange={setPassword}
              showRules
            />
            <PasswordInput label="Confirmar contraseña" value={confirm} onChange={setConfirm} />
            {pwdMsg && <p className="text-xs text-emerald-600">{pwdMsg}</p>}
            {pwdErr && <p className="text-xs text-red-600">{pwdErr}</p>}
            <button
              type="submit"
              disabled={savingPwd}
              className="rounded-xl bg-cea-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-cea-800 disabled:bg-slate-300"
            >
              {savingPwd ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}

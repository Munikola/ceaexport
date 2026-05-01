import { Fragment, useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Copy, Trash2, KeyRound, Power, Plus, X, Settings } from 'lucide-react'
import { api } from '../../api/client'
import type { AuthRole, AuthUser } from '../../contexts/AuthContext'

interface Invitation {
  invitation_id: number
  email: string
  full_name: string | null
  role_id: number
  role: AuthRole
  token: string
  expires_at: string
  used_at: string | null
  is_cancelled: boolean
}

export default function UsersPage() {
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [copiedToast, setCopiedToast] = useState<string | null>(null)

  const usersQ = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => (await api.get<AuthUser[]>('/api/admin/users')).data,
  })
  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: async () => (await api.get<AuthRole[]>('/api/admin/roles')).data,
  })
  const invitationsQ = useQuery({
    queryKey: ['admin', 'invitations'],
    queryFn: async () => (await api.get<Invitation[]>('/api/admin/invitations')).data,
  })

  const pendingInvitations =
    invitationsQ.data?.filter((i) => !i.used_at && !i.is_cancelled && new Date(i.expires_at) > new Date()) ?? []
  const historyInvitations =
    invitationsQ.data?.filter((i) => i.used_at || i.is_cancelled || new Date(i.expires_at) <= new Date()) ?? []

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedToast(label)
    setTimeout(() => setCopiedToast(null), 2000)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-6 sm:px-5">
      <div className="mb-2 flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Usuarios e invitaciones
          </h1>
          <p className="text-sm text-slate-500">
            Invita, cambia roles y gestiona el acceso al sistema.
          </p>
        </div>
      </div>
        {copiedToast && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow-lg">
            {copiedToast}
          </div>
        )}

        {/* Invitar */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <span className="font-medium text-slate-900">+ Invitar usuario</span>
            {showInvite ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
          {showInvite && (
            <InviteForm
              roles={rolesQ.data ?? []}
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
                setShowInvite(false)
              }}
            />
          )}
        </section>

        {/* Pendientes */}
        {pendingInvitations.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Invitaciones pendientes ({pendingInvitations.length})
            </h2>
            <div className="space-y-2">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.invitation_id}
                  className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-slate-900">{inv.email}</p>
                    <p className="text-xs text-slate-600">
                      {inv.role.role_name} · expira{' '}
                      {new Date(inv.expires_at).toLocaleString('es')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        copy(`${window.location.origin}/invitacion/${inv.token}`, 'Enlace copiado')
                      }
                      className="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-3 w-3" /> <span>Copiar enlace</span>
                    </button>
                    <CancelInvitation
                      id={inv.invitation_id}
                      onDone={() =>
                        qc.invalidateQueries({ queryKey: ['admin', 'invitations'] })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Usuarios */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Usuarios ({usersQ.data?.length ?? 0})
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Rol</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersQ.data?.map((u) => (
                  <Fragment key={u.user_id}>
                    <UserRow
                      user={u}
                      roles={rolesQ.data ?? []}
                      onUpdated={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })}
                      onCopy={(text, label) => copy(text, label)}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Historial */}
        {historyInvitations.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Historial de invitaciones
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[480px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {historyInvitations.map((inv) => (
                    <tr key={inv.invitation_id} className="text-slate-500">
                      <td className="px-4 py-2.5">{inv.email}</td>
                      <td className="px-4 py-2.5">{inv.role.role_name}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {inv.used_at
                          ? `Usada ${new Date(inv.used_at).toLocaleDateString('es')}`
                          : inv.is_cancelled
                            ? 'Cancelada'
                            : 'Expirada'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
    </main>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────

function InviteForm({ roles, onCreated }: { roles: AuthRole[]; onCreated: () => void }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleId, setRoleId] = useState<number>(roles[0]?.role_id ?? 0)
  const [err, setErr] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    setSubmitting(true)
    try {
      await api.post('/api/admin/invitations', { email, full_name: fullName || null, role_id: roleId })
      setEmail('')
      setFullName('')
      onCreated()
    } catch (error) {
      const ax = error as AxiosError<{ detail?: string }>
      setErr(ax.response?.data?.detail ?? 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-slate-200 px-6 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
        />
        <input
          type="text"
          placeholder="Nombre (opcional)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
        />
        <select
          value={roleId}
          onChange={(e) => setRoleId(Number(e.target.value))}
          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
        >
          {roles.map((r) => (
            <option key={r.role_id} value={r.role_id}>
              {r.role_name}
            </option>
          ))}
        </select>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={submitting || !email || !roleId}
        className="rounded-xl bg-cea-700 px-4 py-2 text-sm font-medium text-white hover:bg-cea-800 disabled:bg-slate-300"
      >
        {submitting ? 'Creando…' : 'Crear invitación'}
      </button>
    </form>
  )
}

function UserRow({
  user,
  roles,
  onUpdated,
  onCopy,
}: {
  user: AuthUser
  roles: AuthRole[]
  onUpdated: () => void
  onCopy: (text: string, label: string) => void
}) {
  const reset = useMutation({
    mutationFn: async () =>
      (await api.post<{ reset_token: string }>(`/api/admin/users/${user.user_id}/reset-password`)).data,
    onSuccess: (data) => onCopy(`${window.location.origin}/reset/${data.reset_token}`, 'Enlace de reset copiado'),
  })

  const toggle = useMutation({
    mutationFn: async () => api.patch(`/api/admin/users/${user.user_id}/deactivate`),
    onSuccess: onUpdated,
  })

  const del = useMutation({
    mutationFn: async () => api.delete(`/api/admin/users/${user.user_id}`),
    onSuccess: onUpdated,
  })

  const setRole = useMutation({
    mutationFn: async (role_id: number) =>
      api.patch(`/api/admin/users/${user.user_id}`, { role_id }),
    onSuccess: onUpdated,
  })

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{user.full_name}</p>
      </td>
      <td className="px-4 py-3 text-slate-600">{user.email ?? '—'}</td>
      <td className="px-4 py-3">
        <select
          value={user.role_id ?? ''}
          onChange={(e) => setRole.mutate(Number(e.target.value))}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {roles.map((r) => (
            <option key={r.role_id} value={r.role_id}>
              {r.role_name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${user.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
        >
          {user.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex gap-1">
          <button
            onClick={() => reset.mutate()}
            title="Generar enlace de reset"
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <KeyRound className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggle.mutate()}
            title={user.active ? 'Desactivar' : 'Activar'}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <Power className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (confirm(`¿Eliminar a ${user.full_name}?`)) del.mutate()
            }}
            title="Eliminar"
            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function CancelInvitation({ id, onDone }: { id: number; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => api.delete(`/api/admin/invitations/${id}`),
    onSuccess: onDone,
  })
  return (
    <button
      onClick={() => m.mutate()}
      className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
    >
      Cancelar
    </button>
  )
}

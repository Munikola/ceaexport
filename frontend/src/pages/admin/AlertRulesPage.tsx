import { useState, type FormEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { AlertTriangle, Bell, Plus, Trash2, X, Save, Power, PowerOff } from 'lucide-react'
import { api } from '../../api/client'

interface Rule {
  rule_id: number
  rule_name: string
  metric: string
  operator: string
  threshold_value: number | null
  severity: 'info' | 'warn' | 'critical' | null
  action_message: string | null
  active: boolean
}

interface MetricDef {
  code: string
  label: string
}

type RuleDraft = Omit<Rule, 'rule_id'>

const SEVERITY_OPTIONS: { value: Rule['severity']; label: string; cls: string }[] = [
  { value: 'critical', label: 'Crítica', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  { value: 'warn', label: 'Advertencia', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'info', label: 'Informativa', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
]

const OPERATORS = ['>', '>=', '<', '<=', '='] as const

const emptyDraft: RuleDraft = {
  rule_name: '',
  metric: '',
  operator: '>',
  threshold_value: 0,
  severity: 'warn',
  action_message: '',
  active: true,
}

export default function AlertRulesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Rule | null>(null)
  const [creating, setCreating] = useState(false)

  const rulesQ = useQuery({
    queryKey: ['quality-rules'],
    queryFn: async () => (await api.get<Rule[]>('/api/quality-rules')).data,
  })

  const metricsQ = useQuery({
    queryKey: ['quality-rules', 'metrics'],
    queryFn: async () => (await api.get<MetricDef[]>('/api/quality-rules/metrics')).data,
  })

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-3 py-6 sm:px-5">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Reglas de alerta
            </h1>
            <p className="text-sm text-slate-500">
              Configura los umbrales que disparan alertas en el dashboard.
              Cambios aplican al instante (no requiere redeploy).
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg bg-cea-700 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-cea-800"
        >
          <Plus className="h-4 w-4" /> Nueva regla
        </button>
      </div>

      {creating && metricsQ.data && (
        <RuleForm
          metrics={metricsQ.data}
          initial={emptyDraft}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['quality-rules'] })
            setCreating(false)
          }}
          mode="create"
        />
      )}

      {editing && metricsQ.data && (
        <RuleForm
          metrics={metricsQ.data}
          initial={editing}
          ruleId={editing.rule_id}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['quality-rules'] })
            setEditing(null)
          }}
          mode="edit"
        />
      )}

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Regla</th>
              <th className="px-4 py-3 text-left">Métrica</th>
              <th className="px-4 py-3 text-left">Condición</th>
              <th className="px-4 py-3 text-left">Severidad</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(rulesQ.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-400">
                  Sin reglas configuradas. Pulsa <strong>+ Nueva regla</strong>.
                </td>
              </tr>
            ) : (
              rulesQ.data?.map((r) => (
                <RuleRow
                  key={r.rule_id}
                  rule={r}
                  metricLabel={metricsQ.data?.find((m) => m.code === r.metric)?.label ?? r.metric}
                  onEdit={() => setEditing(r)}
                  onChange={() => qc.invalidateQueries({ queryKey: ['quality-rules'] })}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          Las reglas se evalúan al cargar el Dashboard contra el rango de fechas
          seleccionado. Solo las reglas <strong>activas</strong> generan alertas. Las
          severidades crítica/warn aparecen primero.
        </div>
      </div>
    </main>
  )
}

// ───────── Subcomponentes ─────────

function RuleRow({
  rule,
  metricLabel,
  onEdit,
  onChange,
}: {
  rule: Rule
  metricLabel: string
  onEdit: () => void
  onChange: () => void
}) {
  const toggle = useMutation({
    mutationFn: async () =>
      await api.patch(`/api/quality-rules/${rule.rule_id}`, { ...rule, active: !rule.active }),
    onSuccess: onChange,
  })
  const remove = useMutation({
    mutationFn: async () => await api.delete(`/api/quality-rules/${rule.rule_id}`),
    onSuccess: onChange,
  })

  const sev = SEVERITY_OPTIONS.find((s) => s.value === rule.severity)

  return (
    <tr className={rule.active ? '' : 'opacity-50'}>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{rule.rule_name}</div>
        {rule.action_message && (
          <div className="mt-0.5 text-xs text-slate-500">{rule.action_message}</div>
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">{metricLabel}</td>
      <td className="px-4 py-3">
        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs">
          {rule.operator} {rule.threshold_value}
        </code>
      </td>
      <td className="px-4 py-3">
        {sev && (
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${sev.cls}`}>
            {sev.label}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
            rule.active
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-200 text-slate-600'
          }`}
        >
          {rule.active ? 'Activa' : 'Pausada'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            title={rule.active ? 'Pausar regla' : 'Activar regla'}
          >
            {rule.active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
          </button>
          <button
            onClick={onEdit}
            className="rounded bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            Editar
          </button>
          <button
            onClick={() => {
              if (confirm(`¿Eliminar la regla "${rule.rule_name}"?`)) remove.mutate()
            }}
            disabled={remove.isPending}
            className="rounded p-1.5 text-rose-600 hover:bg-rose-50"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function RuleForm({
  initial,
  metrics,
  onCancel,
  onSaved,
  mode,
  ruleId,
}: {
  initial: RuleDraft
  metrics: MetricDef[]
  onCancel: () => void
  onSaved: () => void
  mode: 'create' | 'edit'
  ruleId?: number
}) {
  const [draft, setDraft] = useState<RuleDraft>(initial)
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      if (mode === 'create') return api.post('/api/quality-rules', draft)
      return api.patch(`/api/quality-rules/${ruleId}`, draft)
    },
    onSuccess: onSaved,
    onError: (err) => {
      const ax = err as AxiosError<{ detail?: string }>
      setError(ax.response?.data?.detail ?? 'Error al guardar')
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    save.mutate()
  }

  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-cea-200 bg-cea-50/40 p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">
          {mode === 'create' ? 'Nueva regla' : `Editar regla #${ruleId}`}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="rounded p-1 text-slate-500 hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nombre" required>
          <input
            type="text"
            required
            value={draft.rule_name}
            onChange={(e) => set('rule_name', e.target.value)}
            placeholder="Ej. Defectos críticos"
            className={INPUT}
          />
        </Field>
        <Field label="Severidad">
          <div className="flex gap-1.5">
            {SEVERITY_OPTIONS.map((s) => (
              <button
                key={s.value ?? 'none'}
                type="button"
                onClick={() => set('severity', s.value)}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                  draft.severity === s.value ? s.cls : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Métrica" required>
          <select
            required
            value={draft.metric}
            onChange={(e) => set('metric', e.target.value)}
            className={INPUT}
          >
            <option value="">Seleccionar…</option>
            {metrics.map((m) => (
              <option key={m.code} value={m.code}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Operador" required>
            <select
              required
              value={draft.operator}
              onChange={(e) => set('operator', e.target.value)}
              className={INPUT}
            >
              {OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Umbral" required>
            <input
              type="number"
              step="0.01"
              required
              value={draft.threshold_value ?? ''}
              onChange={(e) =>
                set('threshold_value', e.target.value ? Number(e.target.value) : null)
              }
              className={INPUT}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Mensaje (opcional)">
            <input
              type="text"
              value={draft.action_message ?? ''}
              onChange={(e) => set('action_message', e.target.value || null)}
              placeholder="Texto descriptivo o acción a tomar"
              className={INPUT}
            />
          </Field>
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => set('active', e.target.checked)}
          className="rounded"
        />
        <span className="text-slate-700">Regla activa</span>
      </label>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-cea-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cea-800 disabled:bg-slate-300"
        >
          <Save className="h-4 w-4" />
          {save.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

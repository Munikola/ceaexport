import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Package,
  AlertTriangle,
  FlaskConical,
  Scale,
  CheckCircle,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import { api } from '../../api/client'
import DateRangePicker from '../../components/DateRangePicker'

// ───────── tipos ─────────

interface Kpis {
  start_date: string
  end_date: string
  total_lots: number
  total_lbs: number
  avg_defect_pct: number
  avg_so2: number
  rejected_lots: number
  accepted_lots: number
  rejected_pct: number
}
interface LotsPerDay {
  date: string
  total: number
  aceptados: number
  rechazados: number
  reproceso: number
  sin_decision: number
}
interface SupplierVolume {
  supplier: string
  total_lbs: number
  lots: number
}
interface SupplierDefects {
  supplier: string
  avg_defect_pct: number
  lots: number
}
interface DefectStat {
  defect: string
  category: string | null
  avg_pct: number
  lots: number
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// ───────── paleta sobria ─────────

const PALETTE = {
  primary: '#1e3a8a',     // azul cea profundo
  primarySoft: '#3b82f6', // azul medio
  primaryLight: '#dbeafe', // azul claro fondo
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  surface: '#ffffff',
  ok: '#10b981',
  warn: '#f59e0b',
  danger: '#dc2626',
  neutral: '#94a3b8',
}

// ───────── página ─────────

export default function DashboardPage() {
  const [startDate, setStartDate] = useState(isoDaysAgo(90))
  const [endDate, setEndDate] = useState(isoDaysAgo(0))
  const params = { start_date: startDate, end_date: endDate }

  const kpis = useQuery({
    queryKey: ['dashboard', 'kpis', params],
    queryFn: async () => (await api.get<Kpis>('/api/reports/dashboard/kpis', { params })).data,
  })
  const perDay = useQuery({
    queryKey: ['dashboard', 'per-day', params],
    queryFn: async () =>
      (await api.get<LotsPerDay[]>('/api/reports/dashboard/lots-per-day', { params })).data,
  })
  const topVolume = useQuery({
    queryKey: ['dashboard', 'top-volume', params],
    queryFn: async () =>
      (await api.get<SupplierVolume[]>('/api/reports/dashboard/top-suppliers-by-volume', { params }))
        .data,
  })
  const topDefects = useQuery({
    queryKey: ['dashboard', 'top-defects-suppliers', params],
    queryFn: async () =>
      (await api.get<SupplierDefects[]>('/api/reports/dashboard/top-suppliers-by-defects', { params }))
        .data,
  })
  const defectStats = useQuery({
    queryKey: ['dashboard', 'defects', params],
    queryFn: async () =>
      (await api.get<DefectStat[]>('/api/reports/dashboard/top-defects', { params })).data,
  })

  const k = kpis.data

  return (
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Reportes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            KPIs y tendencias del periodo seleccionado.
          </p>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => {
            setStartDate(s)
            setEndDate(e)
          }}
        />
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          icon={Package}
          label="Lotes"
          value={k?.total_lots?.toLocaleString('es') ?? '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={Scale}
          label="Libras"
          value={k ? formatCompactNumber(k.total_lbs) : '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={AlertTriangle}
          label="% Defectos"
          value={k ? `${k.avg_defect_pct}%` : '—'}
          tone={k && k.avg_defect_pct > 40 ? 'danger' : k && k.avg_defect_pct > 30 ? 'warn' : undefined}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={FlaskConical}
          label="SO₂ ppm"
          value={k ? `${k.avg_so2}` : '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={CheckCircle}
          label="Aceptados"
          value={k?.accepted_lots?.toLocaleString('es') ?? '—'}
          tone="ok"
          loading={kpis.isLoading}
        />
        <Kpi
          icon={XCircle}
          label="% Rechazos"
          value={k ? `${k.rejected_pct}%` : '—'}
          subtle={k ? `${k.rejected_lots} lotes` : undefined}
          tone={k && k.rejected_pct > 5 ? 'danger' : undefined}
          loading={kpis.isLoading}
        />
      </div>

      {/* ── Lotes por día ────────────────────────────────────── */}
      <Section
        title="Lotes recibidos por día"
        subtitle="Apilado por decisión final"
      >
        {perDay.data && perDay.data.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay.data} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: PALETTE.muted }}
                  axisLine={{ stroke: PALETTE.border }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: PALETTE.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={{ fill: PALETTE.primaryLight }} content={<CustomTooltip />} />
                <Bar dataKey="aceptados" stackId="a" fill={PALETTE.ok} name="Aceptados" radius={[0, 0, 0, 0]} />
                <Bar dataKey="rechazados" stackId="a" fill={PALETTE.danger} name="Rechazados" />
                <Bar dataKey="reproceso" stackId="a" fill={PALETTE.warn} name="Reproceso" />
                <Bar dataKey="sin_decision" stackId="a" fill={PALETTE.neutral} name="Sin decisión" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty loading={perDay.isLoading} />
        )}
        <Legend
          items={[
            { color: PALETTE.ok, label: 'Aceptados' },
            { color: PALETTE.danger, label: 'Rechazados' },
            { color: PALETTE.warn, label: 'Reproceso' },
            { color: PALETTE.neutral, label: 'Sin decisión' },
          ]}
        />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Top proveedores por volumen" subtitle="Libras totales recibidas">
          {topVolume.data && topVolume.data.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVolume.data}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: PALETTE.muted }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompactNumber(v)}
                  />
                  <YAxis
                    dataKey="supplier"
                    type="category"
                    tick={{ fontSize: 11, fill: PALETTE.ink }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip
                    cursor={{ fill: PALETTE.primaryLight }}
                    formatter={(v: number) => [`${Math.round(v).toLocaleString('es')} lbs`, 'Volumen']}
                  />
                  <Bar dataKey="total_lbs" fill={PALETTE.primary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty loading={topVolume.isLoading} />
          )}
        </Section>

        <Section title="Proveedores con más defectos" subtitle="Promedio del periodo (≥ 3 lotes)">
          {topDefects.data && topDefects.data.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDefects.data}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: PALETTE.muted }}
                    axisLine={false}
                    tickLine={false}
                    unit="%"
                  />
                  <YAxis
                    dataKey="supplier"
                    type="category"
                    tick={{ fontSize: 11, fill: PALETTE.ink }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip cursor={{ fill: '#fef2f2' }} formatter={(v: number) => [`${v}%`, '% defectos']} />
                  <Bar dataKey="avg_defect_pct" fill={PALETTE.danger} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty loading={topDefects.isLoading} />
          )}
        </Section>
      </div>

      <Section title="Defectos más frecuentes" subtitle="% promedio en el periodo">
        {defectStats.data && defectStats.data.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={defectStats.data}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={PALETTE.border} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: PALETTE.muted }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <YAxis
                  dataKey="defect"
                  type="category"
                  tick={{ fontSize: 11, fill: PALETTE.ink }}
                  axisLine={false}
                  tickLine={false}
                  width={150}
                />
                <Tooltip cursor={{ fill: PALETTE.primaryLight }} formatter={(v: number) => `${v}%`} />
                <Bar dataKey="avg_pct" fill={PALETTE.warn} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty loading={defectStats.isLoading} />
        )}
      </Section>

      <Section title="Distribución de decisiones">
        {k && k.total_lots > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Aceptados', value: k.accepted_lots, fill: PALETTE.ok },
                      { name: 'Rechazados', value: k.rejected_lots, fill: PALETTE.danger },
                      {
                        name: 'Sin decisión',
                        value: Math.max(k.total_lots - k.accepted_lots - k.rejected_lots, 0),
                        fill: PALETTE.neutral,
                      },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {[PALETTE.ok, PALETTE.danger, PALETTE.neutral].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <BreakdownRow label="Aceptados" value={k.accepted_lots} total={k.total_lots} color={PALETTE.ok} />
              <BreakdownRow label="Rechazados" value={k.rejected_lots} total={k.total_lots} color={PALETTE.danger} />
              <BreakdownRow
                label="Sin decisión"
                value={Math.max(k.total_lots - k.accepted_lots - k.rejected_lots, 0)}
                total={k.total_lots}
                color={PALETTE.neutral}
              />
            </div>
          </div>
        ) : (
          <Empty loading={kpis.isLoading} />
        )}
      </Section>
    </main>
  )
}

// ───────── helpers ─────────

function formatCompactNumber(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return Math.round(n).toString()
}

function Kpi({
  icon: Icon,
  label,
  value,
  subtle,
  tone,
  loading,
}: {
  icon: typeof Package
  label: string
  value: string
  subtle?: string
  tone?: 'ok' | 'warn' | 'danger'
  loading?: boolean
}) {
  const toneClasses =
    tone === 'danger'
      ? 'text-rose-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'ok'
          ? 'text-emerald-700'
          : 'text-slate-900'

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400" strokeWidth={2.5} />
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className={`font-semibold tabular-nums tracking-tight ${toneClasses} text-2xl`}>
        {loading ? <span className="text-slate-300">—</span> : value}
      </p>
      {subtle && <p className="mt-0.5 text-xs text-slate-400">{subtle}</p>}
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-5 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Empty({ loading }: { loading?: boolean }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
      {loading ? (
        <p className="text-sm">Cargando…</p>
      ) : (
        <>
          <TrendingUp className="h-6 w-6" />
          <p className="text-sm">Sin datos en este rango</p>
        </>
      )}
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-3 text-xs">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </div>
      ))}
    </div>
  )
}

interface TooltipPayloadEntry {
  name?: string
  value?: number
  color?: string
}
interface TooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}:</span>
          <span className="font-medium tabular-nums text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function BreakdownRow({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-slate-700">
          <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
          {label}
        </span>
        <span className="font-medium tabular-nums text-slate-900">
          {value.toLocaleString('es')}{' '}
          <span className="text-slate-400">· {pct}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

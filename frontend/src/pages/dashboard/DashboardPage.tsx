import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
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
  HelpCircle,
  Bell,
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
  reproceso_lots: number
  sin_decision_lots: number
  rejected_pct: number
  accepted_pct: number
}
interface LotsPerDay {
  date: string
  total: number
  aceptados: number
  rechazados: number
  reproceso: number
  sin_decision: number
  avg_defect_pct: number
  avg_so2: number
  total_lbs: number
}
interface SupplierVolume { supplier: string; total_lbs: number; lots: number; avg_defect_pct: number }
interface SupplierDefects { supplier: string; avg_defect_pct: number; lots: number; total_lbs: number }
interface DefectStat { defect: string; category: string | null; avg_pct: number; lots: number }
interface WorstLot {
  lot_id: number
  analysis_id: number
  lot_code: string
  lot_year: number
  analysis_date: string | null
  reception_date: string | null
  supplier_name: string | null
  product_type: string | null
  total_lbs: number
  pct_defects: number
  so2_global: number
  decision: string | null
  severity: 'critico' | 'alto' | 'medio' | 'normal'
}
interface OperationalAlert {
  kind: string
  title: string
  detail: string
  severity: 'critical' | 'warn' | 'info' | null
  rule?: string
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return Math.round(n).toString()
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Media móvil de N puntos (últimos N días incluido el actual)
function withMA7(data: LotsPerDay[]): (LotsPerDay & { ma7: number | null })[] {
  return data.map((d, i) => {
    if (i < 2) return { ...d, ma7: null }
    const start = Math.max(0, i - 6)
    const window = data.slice(start, i + 1).filter((x) => x.avg_defect_pct > 0)
    if (window.length === 0) return { ...d, ma7: null }
    const avg = window.reduce((s, x) => s + x.avg_defect_pct, 0) / window.length
    return { ...d, ma7: Math.round(avg * 10) / 10 }
  })
}

// ───────── paleta sobria ─────────

const C = {
  primary: '#1e40af',
  primarySoft: '#3b82f6',
  primaryLight: '#eff6ff',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  ok: '#16a34a',
  okLight: '#dcfce7',
  warn: '#f59e0b',
  warnLight: '#fef3c7',
  danger: '#dc2626',
  dangerLight: '#fee2e2',
  neutral: '#94a3b8',
  neutralLight: '#f1f5f9',
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
    queryKey: ['dashboard', 'top-volume'],
    queryFn: async () =>
      (await api.get<SupplierVolume[]>('/api/reports/dashboard/top-suppliers-by-volume')).data,
  })
  const topDefectsSuppliers = useQuery({
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
  const worstLots = useQuery({
    queryKey: ['dashboard', 'worst-lots', params],
    queryFn: async () =>
      (await api.get<WorstLot[]>('/api/reports/dashboard/worst-lots', { params: { ...params, limit: 5 } })).data,
  })
  const opAlerts = useQuery({
    queryKey: ['dashboard', 'op-alerts', params],
    queryFn: async () =>
      (await api.get<OperationalAlert[]>('/api/reports/dashboard/operational-alerts', { params })).data,
  })

  const k = kpis.data
  const perDayMA = useMemo(() => (perDay.data ? withMA7(perDay.data) : []), [perDay.data])

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-3 py-5 sm:px-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard de Calidad
          </h1>
          <p className="text-sm text-slate-500">
            Seguimiento de lotes, defectos y proveedores
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
      </header>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi
          icon={Package} iconBg="bg-blue-50" iconColor="text-blue-600"
          label="Lotes recibidos" value={k?.total_lots?.toLocaleString('es') ?? '—'}
          subtitle="Total en el período" loading={kpis.isLoading}
        />
        <Kpi
          icon={Scale} iconBg="bg-slate-50" iconColor="text-slate-600"
          label="Libras recibidas" value={k ? fmtCompact(k.total_lbs) : '—'}
          subtitle="Total en el período" loading={kpis.isLoading}
        />
        <Kpi
          icon={AlertTriangle} iconBg="bg-rose-50" iconColor="text-rose-600"
          label="% Defectos" value={k ? `${k.avg_defect_pct}%` : '—'}
          subtitle="Promedio del período"
          valueColor={k && k.avg_defect_pct > 40 ? 'text-rose-600' : undefined}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={FlaskConical} iconBg="bg-purple-50" iconColor="text-purple-600"
          label="SO₂ promedio (ppm)" value={k ? `${k.avg_so2}` : '—'}
          subtitle="Promedio del período" loading={kpis.isLoading}
        />
        <Kpi
          icon={CheckCircle} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          label="Aceptados"
          value={k?.accepted_lots?.toLocaleString('es') ?? '—'}
          extraValue={k && k.total_lots > 0 ? `(${k.accepted_pct}%)` : undefined}
          subtitle="Total" valueColor="text-emerald-700" loading={kpis.isLoading}
        />
        <Kpi
          icon={XCircle} iconBg="bg-rose-50" iconColor="text-rose-600"
          label="Rechazados"
          value={k?.rejected_lots?.toLocaleString('es') ?? '—'}
          extraValue={k && k.total_lots > 0 ? `(${k.rejected_pct}%)` : undefined}
          subtitle="Total" valueColor="text-rose-600" loading={kpis.isLoading}
        />
        <Kpi
          icon={HelpCircle} iconBg="bg-slate-100" iconColor="text-slate-500"
          label="Sin decisión"
          value={k?.sin_decision_lots?.toLocaleString('es') ?? '—'}
          extraValue={k && k.total_lots > 0 ? `(${Math.round((k.sin_decision_lots / k.total_lots) * 100)}%)` : undefined}
          subtitle="Total" loading={kpis.isLoading}
        />
      </div>

      {/* ── Gráfico evolución diaria con doble eje + MA7 ──────── */}
      <Section title="Evolución diaria de lotes y % de defectos">
        {perDayMA.length > 0 ? (
          <>
            <Legend
              items={[
                { color: C.ok, label: 'Aceptados' },
                { color: C.danger, label: 'Rechazados' },
                { color: C.neutral, label: 'Sin decisión' },
                { color: C.danger, label: '% Defectos', kind: 'line' },
                { color: C.danger, label: '% Defectos (MA 7 días)', kind: 'dashed' },
              ]}
            />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={perDayMA} margin={{ top: 8, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis
                    dataKey="date" tick={{ fontSize: 11, fill: C.muted }}
                    tickFormatter={(d: string) => fmtDate(d).slice(0, 5)}
                    axisLine={{ stroke: C.border }} tickLine={false}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false}
                    label={{ value: 'Lotes', angle: -90, position: 'insideLeft', fontSize: 11, fill: C.muted }}
                  />
                  <YAxis
                    yAxisId="right" orientation="right" unit="%"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false}
                    label={{ value: '% Defectos', angle: 90, position: 'insideRight', fontSize: 11, fill: C.muted }}
                  />
                  <Tooltip content={<DailyTooltip />} cursor={{ fill: C.primaryLight }} />
                  <Bar yAxisId="left" dataKey="aceptados" stackId="a" fill={C.ok} name="Aceptados" />
                  <Bar yAxisId="left" dataKey="rechazados" stackId="a" fill={C.danger} name="Rechazados" />
                  <Bar yAxisId="left" dataKey="sin_decision" stackId="a" fill={C.neutral} name="Sin decisión" radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_defect_pct"
                    stroke={C.danger} strokeWidth={2} dot={false} name="% Defectos" />
                  <Line yAxisId="right" type="monotone" dataKey="ma7"
                    stroke={C.danger} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="MA 7 días" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Empty loading={perDay.isLoading} />
        )}
      </Section>

      {/* ── 3 paneles + Alertas ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Section title="Top proveedores por volumen" subtitle="Libras recibidas (últimos 90 días)">
          {topVolume.data && topVolume.data.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={topVolume.data} layout="vertical"
                  margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }}
                    axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} />
                  <YAxis dataKey="supplier" type="category"
                    tick={{ fontSize: 10, fill: C.ink }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip cursor={{ fill: C.primaryLight }}
                    formatter={(v: number) => [`${Math.round(v).toLocaleString('es')} lbs`, 'Volumen']} />
                  <Bar dataKey="total_lbs" fill={C.primary} radius={[0, 4, 4, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (<Empty loading={topVolume.isLoading} />)}
        </Section>

        <Section title="Defectos más frecuentes" subtitle="% promedio en el período">
          {defectStats.data && defectStats.data.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={defectStats.data} layout="vertical"
                  margin={{ top: 5, right: 25, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: C.muted }}
                    axisLine={false} tickLine={false} unit="%" />
                  <YAxis dataKey="defect" type="category"
                    tick={{ fontSize: 10, fill: C.ink }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip cursor={{ fill: C.warnLight }} formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="avg_pct" fill={C.warn} radius={[0, 4, 4, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (<Empty loading={defectStats.isLoading} />)}
        </Section>

        {/* Tabla proveedores con más defectos (estilo mockup) */}
        <Section title="Proveedores con mayor % de defectos" subtitle="Mínimo 3 lotes en el período">
          {topDefectsSuppliers.data && topDefectsSuppliers.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="pb-2 text-left">Proveedor</th>
                    <th className="pb-2 text-left">% Defectos</th>
                    <th className="pb-2 text-right">Libras</th>
                    <th className="pb-2 text-right">Lotes</th>
                  </tr>
                </thead>
                <tbody>
                  {topDefectsSuppliers.data.slice(0, 10).map((s) => {
                    const pct = Math.min(s.avg_defect_pct, 100)
                    return (
                      <tr key={s.supplier} className="border-t border-slate-100">
                        <td className="py-1.5 font-medium text-slate-800">{s.supplier}</td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-rose-100">
                              <div className="h-full rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="tabular-nums text-slate-700">{s.avg_defect_pct}%</span>
                          </div>
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-slate-600">{fmtCompact(s.total_lbs)}</td>
                        <td className="py-1.5 text-right tabular-nums text-slate-600">{s.lots}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (<Empty loading={topDefectsSuppliers.isLoading} />)}
        </Section>

        {/* Alertas operativas */}
        <Section
          title={
            <span className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-amber-600" /> Alertas operativas
            </span>
          }
          subtitle="Reglas en /admin/alertas"
        >
          {opAlerts.data && opAlerts.data.length > 0 ? (
            <ul className="space-y-2">
              {opAlerts.data.slice(0, 6).map((a, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
                  <SeverityIcon severity={a.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">{a.title}</p>
                    <p className="truncate text-[11px] text-slate-500">{a.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-1 text-slate-400">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <p className="text-xs">Sin alertas activas</p>
              <Link to="/admin/alertas" className="text-[11px] text-cea-600 hover:underline">
                Configurar reglas
              </Link>
            </div>
          )}
        </Section>
      </div>

      {/* ── Tabla últimos lotes con peor % defectos + donut decisiones ─── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section title="Últimos lotes con mayor % defectos" subtitle="Top 5 del período">
            {worstLots.data && worstLots.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-2 text-left">Lote</th>
                      <th className="pb-2 text-left">Fecha</th>
                      <th className="pb-2 text-left">Proveedor</th>
                      <th className="pb-2 text-left">Producto</th>
                      <th className="pb-2 text-right">Libras</th>
                      <th className="pb-2 text-right">% Defectos</th>
                      <th className="pb-2 text-right">SO₂</th>
                      <th className="pb-2 text-left">Decisión</th>
                      <th className="pb-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {worstLots.data.map((lot) => (
                      <tr key={`${lot.lot_id}-${lot.analysis_id}`} className="hover:bg-slate-50">
                        <td className="py-2 font-medium text-slate-900">
                          <Link
                            to={`/analisis/${lot.analysis_id}`}
                            className="text-cea-700 hover:underline"
                          >
                            {lot.lot_code}
                          </Link>
                        </td>
                        <td className="py-2 tabular-nums text-slate-600">{fmtDate(lot.reception_date ?? lot.analysis_date)}</td>
                        <td className="py-2 text-slate-700">{lot.supplier_name ?? '—'}</td>
                        <td className="py-2 text-slate-600">{lot.product_type ?? '—'}</td>
                        <td className="py-2 text-right tabular-nums text-slate-700">
                          {Math.round(lot.total_lbs).toLocaleString('es')}
                        </td>
                        <td className="py-2 text-right">
                          <span className={`rounded px-1.5 py-0.5 font-semibold tabular-nums ${
                            lot.severity === 'critico' ? 'bg-rose-50 text-rose-700' :
                            lot.severity === 'alto'    ? 'bg-amber-50 text-amber-700' :
                                                         'text-slate-700'
                          }`}>
                            {lot.pct_defects}%
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-600">{lot.so2_global ? lot.so2_global : '—'}</td>
                        <td className="py-2 text-slate-600">{lot.decision ?? '—'}</td>
                        <td className="py-2"><SeverityBadge severity={lot.severity} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-center">
                  <Link to="/analisis" className="text-xs text-cea-600 hover:underline">Ver más →</Link>
                </div>
              </div>
            ) : (<Empty loading={worstLots.isLoading} />)}
          </Section>
        </div>

        <Section title="Distribución de decisiones">
          {k && k.total_lots > 0 ? (
            <div className="space-y-3">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Aceptados', value: k.accepted_lots, fill: C.ok },
                        { name: 'Rechazados', value: k.rejected_lots, fill: C.danger },
                        {
                          name: 'Sin decisión',
                          value: Math.max(k.total_lots - k.accepted_lots - k.rejected_lots, 0),
                          fill: C.neutral,
                        },
                      ]}
                      dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75} paddingAngle={2} strokeWidth={0}
                    >
                      {[C.ok, C.danger, C.neutral].map((c, i) => (<Cell key={i} fill={c} />))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                <BreakdownRow label="Aceptados" value={k.accepted_lots} total={k.total_lots} color={C.ok} />
                <BreakdownRow label="Rechazados" value={k.rejected_lots} total={k.total_lots} color={C.danger} />
                <BreakdownRow
                  label="Sin decisión"
                  value={Math.max(k.total_lots - k.accepted_lots - k.rejected_lots, 0)}
                  total={k.total_lots} color={C.neutral}
                />
              </div>
            </div>
          ) : (<Empty loading={kpis.isLoading} />)}
        </Section>
      </div>
    </main>
  )
}

// ───────── helpers de UI ─────────

function Kpi({
  icon: Icon, iconBg, iconColor, label, value, extraValue, subtitle, valueColor, loading,
}: {
  icon: typeof Package
  iconBg: string
  iconColor: string
  label: string
  value: string
  extraValue?: string
  subtitle?: string
  valueColor?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 transition hover:border-slate-300">
      <div className="flex items-center gap-2.5">
        <div className={`shrink-0 rounded-lg p-2 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} strokeWidth={2.5} />
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <div className="mt-2.5">
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${valueColor ?? 'text-slate-900'}`}>
          {loading ? <span className="text-slate-300">—</span> : value}
          {extraValue && (
            <span className="ml-1 text-sm font-medium text-slate-400">{extraValue}</span>
          )}
        </p>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  )
}

function Section({
  title, subtitle, children,
}: {
  title: React.ReactNode
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Empty({ loading }: { loading?: boolean }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-2 text-slate-400">
      {loading ? <p className="text-sm">Cargando…</p> : (<>
        <TrendingUp className="h-5 w-5" />
        <p className="text-sm">Sin datos en este rango</p>
      </>)}
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string; kind?: 'bar' | 'line' | 'dashed' }[] }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5 text-slate-600">
          {it.kind === 'line' ? (
            <span className="h-0.5 w-4 rounded-full" style={{ background: it.color }} />
          ) : it.kind === 'dashed' ? (
            <span className="h-0.5 w-4" style={{
              backgroundImage: `repeating-linear-gradient(90deg, ${it.color} 0 4px, transparent 4px 8px)`,
            }} />
          ) : (
            <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />
          )}
          {it.label}
        </div>
      ))}
    </div>
  )
}

interface TooltipPayload { name?: string; value?: number; color?: string; dataKey?: string }
function DailyTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{fmtDate(label || null)}</p>
      {payload.map((p, i) => {
        const isPct = p.dataKey === 'avg_defect_pct' || p.dataKey === 'ma7'
        return (
          <div key={i} className="flex items-center gap-2 text-slate-600">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            <span>{p.name}:</span>
            <span className="font-medium tabular-nums text-slate-900">
              {isPct ? `${p.value}%` : p.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BreakdownRow({ label, value, total, color }: {
  label: string; value: number; total: number; color: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-slate-700">
          <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
          {label}
        </span>
        <span className="font-medium tabular-nums text-slate-900">
          {value.toLocaleString('es')} <span className="text-slate-400">· {pct}%</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function SeverityIcon({ severity }: { severity: OperationalAlert['severity'] }) {
  const map: Record<string, string> = {
    critical: 'text-rose-600 bg-rose-100',
    warn: 'text-amber-600 bg-amber-100',
    info: 'text-slate-500 bg-slate-100',
  }
  const cls = map[severity ?? 'info'] ?? map.info
  return (
    <div className={`shrink-0 rounded p-1.5 ${cls}`}>
      <AlertTriangle className="h-3.5 w-3.5" />
    </div>
  )
}

function SeverityBadge({ severity }: { severity: WorstLot['severity'] }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    critico: { bg: 'bg-rose-500', text: 'text-white', label: 'Crítico' },
    alto:    { bg: 'bg-amber-500', text: 'text-white', label: 'Alto' },
    medio:   { bg: 'bg-slate-300', text: 'text-slate-700', label: 'Medio' },
    normal:  { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Normal' },
  }
  const cfg = map[severity] ?? map.normal
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

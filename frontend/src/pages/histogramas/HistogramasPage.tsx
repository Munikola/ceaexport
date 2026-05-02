import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts'
import {
  Package,
  Scale,
  Target,
  AlertTriangle,
  Lightbulb,
  TrendingUp as TrendingUpIcon,
} from 'lucide-react'
import { api } from '../../api/client'
import DateRangePicker from '../../components/DateRangePicker'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'
import { useCatalog } from '../../hooks/useCatalogs'
import Skeleton from '../../components/Skeleton'
import EmptyState from '../../components/EmptyState'
import { useCountUp } from '../../hooks/useCountUp'

// ───────── tipos ─────────

interface Bucket {
  min_g: number
  max_g: number
  label: string
  lots: number
  pct: number
  cumulative_pct: number
  category: 'optimo' | 'aceptable' | 'critico'
  bucket_avg: number
}

interface DistResp {
  config: {
    optimal_min: number
    optimal_max: number
    aceptable_lower_min: number
    aceptable_upper_max: number
    bucket_size: number
    target_grammage: number
    start_date: string
    end_date: string
    product_type: string | null
    supplier: string | null
  }
  kpis: {
    total_lots: number
    avg_grammage: number
    in_optimal_lots: number
    in_optimal_pct: number
    out_of_range_lots: number
    out_of_range_pct: number
  }
  buckets: Bucket[]
  evolution: { month: string; avg_grammage: number; lots: number; in_optimal: boolean }[]
  summary: {
    min: number
    max: number
    avg: number
    days_in_range: number
    days_total: number
    days_in_range_pct: number
    days_out_pct: number
  }
  insight: {
    main: string
    detail: string
    impacts: string[]
  }
}

// ───────── paleta ─────────

const COLOR = {
  critico: '#dc2626',
  criticoSoft: '#fee2e2',
  aceptable: '#f59e0b',
  aceptableSoft: '#fef3c7',
  optimo: '#16a34a',
  optimoSoft: '#dcfce7',
  acumulado: '#0f172a',
  media: '#94a3b8',
  objetivo: '#16a34a',
  ink: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  primary: '#7c3aed',
  primarySoft: '#ede9fe',
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function fmtMonth(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }).toLowerCase()
}

// ───────── página ─────────

export default function HistogramasPage() {
  const [startDate, setStartDate] = useState(isoDaysAgo(180))
  const [endDate, setEndDate] = useState(isoDaysAgo(0))
  const [productType, setProductType] = useState<'' | 'ENTERO' | 'COLA'>('')
  const [supplierId, setSupplierId] = useState<number | null>(null)

  const suppliers = useCatalog('suppliers')
  const supplierName = suppliers.data?.find((s) => s.id === supplierId)?.name

  const params: Record<string, string> = {
    start_date: startDate,
    end_date: endDate,
  }
  if (productType) params.product_type = productType
  if (supplierName) params.supplier = supplierName

  const dist = useQuery({
    queryKey: ['hist', 'calibre-distribution', params],
    queryFn: async () =>
      (await api.get<DistResp>('/api/reports/histogram/calibre-distribution', { params })).data,
  })

  const data = dist.data

  // Para Pareto: agregamos cumulative_pct dentro del mismo objeto
  const chartData = useMemo(() => data?.buckets ?? [], [data])

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-3 py-5 sm:px-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
            <FlaskIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Distribución de calibres y control de calidad
            </h1>
            <p className="text-sm text-slate-500">
              Análisis de desviación vs rango óptimo (
              {data?.config.optimal_min ?? 40}–{data?.config.optimal_max ?? 60} g)
            </p>
          </div>
        </div>
      </header>

      {/* ── Filtros ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Tipo de producto">
          <div className="flex gap-1.5">
            {([
              { v: '', label: 'Todos' },
              { v: 'ENTERO', label: 'Entero' },
              { v: 'COLA', label: 'Cola' },
            ] as const).map((opt) => (
              <button
                key={opt.v || 'todos'}
                onClick={() => setProductType(opt.v)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  productType === opt.v
                    ? 'border-purple-700 bg-purple-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Proveedor (opcional)">
          <CatalogAutocomplete
            catalog="suppliers"
            value={supplierId}
            onChange={setSupplierId}
            allowCreate={false}
            placeholder="Todos los proveedores"
          />
        </Field>
        <Field label="Período">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s)
              setEndDate(e)
            }}
          />
        </Field>
      </div>

      {/* ── KPIs ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={Package} iconBg="bg-purple-100" iconColor="text-purple-700"
          label="Total lotes"
          value={data?.kpis.total_lots?.toLocaleString('es') ?? '—'}
          subtitle="lotes en el periodo"
          loading={dist.isLoading}
        />
        <Kpi
          icon={Scale} iconBg="bg-slate-100" iconColor="text-slate-700"
          label="Peso medio"
          value={data ? `${data.kpis.avg_grammage} g` : '—'}
          subtitle="promedio del periodo"
          loading={dist.isLoading}
        />
        <Kpi
          icon={Target} iconBg="bg-emerald-100" iconColor="text-emerald-700"
          label={`% en rango óptimo (${data?.config.optimal_min ?? 40}–${data?.config.optimal_max ?? 60} g)`}
          value={data ? `${data.kpis.in_optimal_pct}%` : '—'}
          subtitle={data ? `${data.kpis.in_optimal_lots} lotes` : ''}
          valueColor="text-emerald-700"
          loading={dist.isLoading}
        />
        <Kpi
          icon={AlertTriangle} iconBg="bg-rose-100" iconColor="text-rose-700"
          label="% fuera de rango"
          value={data ? `${data.kpis.out_of_range_pct}%` : '—'}
          subtitle={data ? `${data.kpis.out_of_range_lots} lotes` : ''}
          valueColor="text-rose-700"
          loading={dist.isLoading}
        />
      </div>

      {/* ── Gráfico Pareto + Insight ──────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Distribución de calibres vs rango óptimo
          </h2>

          {/* Leyenda */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
            <LegendDot color={COLOR.critico} label={`Crítico (<${data?.config.aceptable_lower_min ?? 30} o >${data?.config.aceptable_upper_max ?? 70})`} />
            <LegendDot color={COLOR.aceptable} label={`Aceptable (${data?.config.aceptable_lower_min ?? 30}–${data?.config.optimal_min ?? 40} o ${data?.config.optimal_max ?? 60}–${data?.config.aceptable_upper_max ?? 70})`} />
            <LegendDot color={COLOR.optimo} label={`Óptimo (${data?.config.optimal_min ?? 40}–${data?.config.optimal_max ?? 60})`} />
            <LegendLine color={COLOR.media} label={`Media (${data?.kpis.avg_grammage ?? '—'} g)`} dashed />
            <LegendLine color={COLOR.objetivo} label={`Objetivo (${data?.config.target_grammage ?? 50} g)`} dashed />
            <LegendLine color={COLOR.acumulado} label="% acumulado" />
          </div>

          {chartData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 16, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLOR.border} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: COLOR.muted }}
                    axisLine={{ stroke: COLOR.border }} tickLine={false}
                    label={{ value: 'Calibre (g)', position: 'insideBottom', offset: -2, fontSize: 11, fill: COLOR.muted }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={false} tickLine={false}
                    label={{ value: 'Nº de lotes', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLOR.muted }}
                  />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%"
                    tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={false} tickLine={false}
                    label={{ value: '% acumulado', angle: 90, position: 'insideRight', fontSize: 11, fill: COLOR.muted }}
                  />
                  <Tooltip content={<BucketTooltip />} cursor={{ fill: '#f8fafc' }} />

                  {/* Líneas de referencia: media y objetivo */}
                  {data && (
                    <ReferenceLine
                      yAxisId="left"
                      x={findClosestBucket(chartData, data.kpis.avg_grammage)}
                      stroke={COLOR.media} strokeDasharray="4 4" strokeWidth={1.5}
                    />
                  )}
                  {data && (
                    <ReferenceLine
                      yAxisId="left"
                      x={findClosestBucket(chartData, data.config.target_grammage)}
                      stroke={COLOR.objetivo} strokeDasharray="4 4" strokeWidth={1.5}
                    />
                  )}

                  {/* Barras coloreadas según category */}
                  <Bar yAxisId="left" dataKey="lots" radius={[4, 4, 0, 0]}>
                    {chartData.map((b, i) => (
                      <Cell
                        key={i}
                        fill={
                          b.category === 'optimo' ? COLOR.optimo :
                          b.category === 'aceptable' ? COLOR.aceptable :
                          COLOR.critico
                        }
                      />
                    ))}
                  </Bar>

                  {/* Línea de % acumulado (Pareto) */}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative_pct"
                    stroke={COLOR.acumulado}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COLOR.acumulado }}
                    name="% acumulado"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState loading={dist.isLoading} variant="chart"
              title="Sin lotes en este rango"
              description="Cambia el periodo o quita los filtros" />
          )}
        </section>

        {/* Insight clave */}
        <section className="rounded-xl border border-purple-200 bg-purple-50/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-purple-600" />
            <h3 className="text-base font-semibold text-slate-900">Insight clave</h3>
          </div>
          {data ? (
            <>
              <p className="text-sm leading-relaxed text-slate-800">
                {/* main destacando el % */}
                {renderInsightMain(data.insight.main)}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-slate-600">
                {data.insight.detail}
              </p>
              <div className="mt-4 border-t border-purple-200 pt-3">
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUpIcon className="h-4 w-4 text-purple-600" />
                  <h4 className="text-sm font-semibold text-slate-900">Impacto potencial</h4>
                </div>
                <ul className="space-y-1 text-xs text-slate-700">
                  {data.insight.impacts.map((imp, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-purple-600" />
                      {imp}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">Cargando…</p>
          )}
        </section>
      </div>

      {/* ── Evolución gramaje vs objetivo + Resumen ────────── */}
      <div className="grid gap-4 lg:grid-cols-4">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Evolución del gramaje vs objetivo
          </h2>
          {data && data.evolution.length > 0 ? (
            <>
              {/* Leyenda */}
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-600">
                <LegendLine color={COLOR.primary} label="Gramaje promedio (g)" />
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded" style={{ background: COLOR.optimoSoft, border: `1px dashed ${COLOR.optimo}` }} />
                  Rango objetivo ({data.config.optimal_min}–{data.config.optimal_max} g)
                </span>
              </div>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={data.evolution.map((e) => ({
                      ...e,
                      objetivo_max: data.config.optimal_max,
                      objetivo_min: data.config.optimal_min,
                    }))}
                    margin={{ top: 8, right: 16, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLOR.border} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: COLOR.muted }}
                      axisLine={{ stroke: COLOR.border }} tickLine={false}
                      tickFormatter={fmtMonth}
                    />
                    <YAxis
                      domain={[
                        Math.max(0, Math.floor(data.summary.min - 4)),
                        Math.ceil(data.summary.max + 4),
                      ]}
                      tick={{ fontSize: 11, fill: COLOR.muted }} axisLine={false} tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => {
                        if (name === 'avg_grammage') return [`${v} g`, 'Gramaje promedio']
                        return [v, name]
                      }}
                      labelFormatter={(l: string) => fmtMonth(l)}
                    />

                    {/* Banda objetivo (área entre min y max) */}
                    <ReferenceLine y={data.config.optimal_min} stroke={COLOR.optimo} strokeDasharray="4 4" />
                    <ReferenceLine y={data.config.optimal_max} stroke={COLOR.optimo} strokeDasharray="4 4" />

                    <Line
                      type="monotone" dataKey="avg_grammage"
                      stroke={COLOR.primary} strokeWidth={2.5}
                      dot={(props: { cx?: number; cy?: number; payload?: { in_optimal: boolean } }) => {
                        const inOpt = props.payload?.in_optimal
                        return (
                          <circle
                            cx={props.cx} cy={props.cy} r={5}
                            fill={inOpt ? COLOR.primary : COLOR.critico}
                            stroke="white" strokeWidth={2}
                          />
                        )
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <EmptyState loading={dist.isLoading} variant="chart"
              title="Sin lotes en este rango"
              description="Cambia el periodo o quita los filtros" />
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Resumen del periodo</h3>
          {data ? (
            <dl className="space-y-3 text-sm">
              <SummaryRow label="Mínimo" value={`${data.summary.min} g`} />
              <SummaryRow label="Máximo" value={`${data.summary.max} g`} valueColor="text-rose-600" />
              <SummaryRow label="Promedio" value={`${data.summary.avg} g`} />
              <SummaryRow
                label="Días en rango"
                value={`${data.summary.days_in_range_pct}%`}
                valueColor="text-emerald-600"
              />
              <SummaryRow
                label="Días fuera de rango"
                value={`${data.summary.days_out_pct}%`}
                valueColor="text-amber-600"
              />
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Cargando…</p>
          )}
        </section>
      </div>

      {/* Footer pequeño */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-400">
        <span>Fuente: Sistema de control de calidad CEA</span>
        {data && (
          <span>Datos del {data.config.start_date} al {data.config.end_date}</span>
        )}
      </div>
    </main>
  )
}

// ───────── helpers ─────────

function FlaskIcon({ className }: { className?: string }) {
  // Simple flask icon as SVG (for variation from lucide)
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v6L4 21h16L15 9V3" />
      <line x1="9" y1="3" x2="15" y2="3" />
    </svg>
  )
}

function findClosestBucket(buckets: Bucket[], value: number): string | undefined {
  if (!buckets.length) return undefined
  let closest = buckets[0]
  let min = Math.abs((closest.min_g + closest.max_g) / 2 - value)
  for (const b of buckets) {
    const d = Math.abs((b.min_g + b.max_g) / 2 - value)
    if (d < min) {
      min = d
      closest = b
    }
  }
  return closest.label
}

function renderInsightMain(text: string) {
  // Resalta el primer porcentaje en azul/morado bold
  const match = text.match(/(\d+(?:\.\d+)?)%/)
  if (!match) return text
  const before = text.slice(0, match.index)
  const pct = match[0]
  const after = text.slice((match.index ?? 0) + pct.length)
  return (
    <>
      {before}
      <span className="text-base font-bold text-purple-700">{pct}</span>
      {after}
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function Kpi({
  icon: Icon, iconBg, iconColor, label, value, subtitle, valueColor, loading,
}: {
  icon: typeof Package; iconBg: string; iconColor: string
  label: string; value: string; subtitle?: string; valueColor?: string; loading?: boolean
}) {
  return (
    <div className="fade-in group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`shrink-0 rounded-lg p-2.5 ${iconBg} transition group-hover:scale-110`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        </div>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight ${valueColor ?? 'text-slate-900'}`}>
          <AnimatedKpiValue value={value} />
        </p>
      )}
      {subtitle ? (
        <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      ) : (
        <p className="mt-0.5 h-[16px]" />
      )}
    </div>
  )
}

function AnimatedKpiValue({ value }: { value: string }) {
  const m = value.match(/^([\d.,]+)\s*([%\w\s]*)?$/)
  if (!m) return <>{value}</>
  const numStr = m[1].replace(/,/g, '')
  const num = parseFloat(numStr)
  const suffix = m[2] ?? ''
  const isFloat = numStr.includes('.')
  const animated = useCountUp(isFinite(num) ? num : 0, 700)
  if (!isFinite(num)) return <>{value}</>
  const formatted = isFloat
    ? animated.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : Math.round(animated).toLocaleString('es')
  return <>{formatted}{suffix && <> {suffix}</>}</>
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {dashed ? (
        <span
          className="h-0.5 w-4"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 8px)`,
          }}
        />
      ) : (
        <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      )}
      {label}
    </span>
  )
}


interface TooltipPayload { value?: number; payload?: Bucket }
function BucketTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const b = payload[0]?.payload
  if (!b) return null
  const catLabel = {
    optimo: 'Óptimo',
    aceptable: 'Aceptable',
    critico: 'Crítico',
  }[b.category]
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-0.5 font-medium text-slate-900">Calibre {b.label} g</p>
      <p className="text-slate-600">
        <strong>{b.lots}</strong> lotes ({b.pct}%)
      </p>
      <p className="text-[11px] text-slate-500">% acumulado: {b.cumulative_pct}%</p>
      <p className="mt-0.5 text-[11px] font-medium" style={{
        color: b.category === 'optimo' ? COLOR.optimo
             : b.category === 'aceptable' ? COLOR.aceptable
             : COLOR.critico
      }}>
        {catLabel}
      </p>
    </div>
  )
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`text-sm font-semibold tabular-nums ${valueColor ?? 'text-slate-900'}`}>
        {value}
      </dd>
    </div>
  )
}

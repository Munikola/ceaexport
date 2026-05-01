import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Package, AlertTriangle, FlaskConical, Scale, CheckCircle, XCircle } from 'lucide-react'
import { api } from '../../api/client'
import DateRangePicker from '../../components/DateRangePicker'

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

const COLORS = {
  cea: '#1e40af',
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
  slate: '#64748b',
}

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
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">KPIs y tendencias del periodo seleccionado</p>
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

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Kpi
          icon={Package}
          color="bg-cea-600"
          label="Lotes recibidos"
          value={k?.total_lots?.toLocaleString('es') ?? '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={Scale}
          color="bg-slate-600"
          label="Libras totales"
          value={k ? Math.round(k.total_lbs).toLocaleString('es') : '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={AlertTriangle}
          color="bg-amber-600"
          label="% Defectos prom."
          value={k ? `${k.avg_defect_pct}%` : '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={FlaskConical}
          color="bg-purple-600"
          label="SO₂ promedio"
          value={k ? `${k.avg_so2} ppm` : '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={CheckCircle}
          color="bg-emerald-600"
          label="Aceptados"
          value={k?.accepted_lots?.toLocaleString('es') ?? '—'}
          loading={kpis.isLoading}
        />
        <Kpi
          icon={XCircle}
          color="bg-rose-600"
          label="% Rechazos"
          value={k ? `${k.rejected_pct}%` : '—'}
          subtle={k ? `${k.rejected_lots} lotes` : undefined}
          loading={kpis.isLoading}
        />
      </div>

      {/* Lotes por día */}
      <Section title="Lotes recibidos por día">
        {perDay.data && perDay.data.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perDay.data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="aceptados" stackId="a" fill={COLORS.emerald} name="Aceptados" />
                <Bar dataKey="rechazados" stackId="a" fill={COLORS.rose} name="Rechazados" />
                <Bar dataKey="reproceso" stackId="a" fill={COLORS.amber} name="Reproceso" />
                <Bar dataKey="sin_decision" stackId="a" fill={COLORS.slate} name="Sin decisión" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty />
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top proveedores por volumen (lbs)">
          {topVolume.data && topVolume.data.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topVolume.data}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="supplier" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString('es')} lbs`} />
                  <Bar dataKey="total_lbs" fill={COLORS.cea} name="Libras" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </Section>

        <Section title="Proveedores con más defectos (≥ 3 lotes)">
          {topDefects.data && topDefects.data.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDefects.data}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 90, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                  <YAxis dataKey="supplier" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Bar dataKey="avg_defect_pct" fill={COLORS.rose} name="% defectos prom." />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </Section>
      </div>

      <Section title="Defectos más frecuentes en el periodo">
        {defectStats.data && defectStats.data.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={defectStats.data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 110, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                <YAxis dataKey="defect" type="category" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="avg_pct" fill={COLORS.amber} name="% promedio" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty />
        )}
      </Section>

      {/* Decisión: pie */}
      <Section title="Distribución de decisiones">
        {k ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Aceptados', value: k.accepted_lots, fill: COLORS.emerald },
                    { name: 'Rechazados', value: k.rejected_lots, fill: COLORS.rose },
                    {
                      name: 'Sin decisión',
                      value: Math.max(k.total_lots - k.accepted_lots - k.rejected_lots, 0),
                      fill: COLORS.slate,
                    },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e) => `${e.name}: ${e.value}`}
                >
                  {[COLORS.emerald, COLORS.rose, COLORS.slate].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty />
        )}
      </Section>
    </main>
  )
}

// ───────── helpers de UI ─────────

function Kpi({
  icon: Icon,
  color,
  label,
  value,
  subtle,
  loading,
}: {
  icon: typeof Package
  color: string
  label: string
  value: string
  subtle?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className={`rounded-md ${color} p-1.5 text-white`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-slate-900">{loading ? '…' : value}</p>
      {subtle && <p className="text-xs text-slate-400">{subtle}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

function Empty() {
  return (
    <div className="flex h-40 items-center justify-center text-sm text-slate-400">
      Sin datos en este rango
    </div>
  )
}

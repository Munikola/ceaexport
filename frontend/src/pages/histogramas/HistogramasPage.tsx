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
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { FlaskConical } from 'lucide-react'
import { api } from '../../api/client'
import DateRangePicker from '../../components/DateRangePicker'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'
import { useCatalog } from '../../hooks/useCatalogs'

interface HistBucket {
  classification: string
  lots: number
  total_lbs: number
  pct: number
}

interface HistResp {
  start_date: string
  end_date: string
  total_lots: number
  buckets: HistBucket[]
}

interface GrammageMonth {
  month: string
  avg_grammage: number
  lots: number
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

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

  const hist = useQuery({
    queryKey: ['histogramas', 'classification', params],
    queryFn: async () =>
      (await api.get<HistResp>('/api/reports/histogram/by-classification', { params })).data,
  })

  const trend = useQuery({
    queryKey: ['histogramas', 'trend', { start_date: startDate, end_date: endDate }],
    queryFn: async () =>
      (
        await api.get<GrammageMonth[]>('/api/reports/histogram/grammage-trend', {
          params: { start_date: startDate, end_date: endDate },
        })
      ).data,
  })

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <FlaskConical className="h-6 w-6 text-purple-600" />
            Histogramas
          </h1>
          <p className="text-sm text-slate-500">
            Distribución de tallas (clasificación CC) en el periodo seleccionado.
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

      {/* Filtros adicionales */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Tipo de producto
          </label>
          <div className="flex gap-1.5">
            {(['', 'ENTERO', 'COLA'] as const).map((opt) => (
              <button
                key={opt || 'todos'}
                onClick={() => setProductType(opt)}
                className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  productType === opt
                    ? 'border-cea-700 bg-cea-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt || 'Todos'}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          <CatalogAutocomplete
            catalog="suppliers"
            label="Proveedor (opcional)"
            value={supplierId}
            onChange={setSupplierId}
            allowCreate={false}
            placeholder="Todos los proveedores"
          />
        </div>
      </div>

      {/* Distribución por clasificación */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Distribución por clasificación CC
          </h2>
          <p className="text-sm text-slate-500">
            {hist.data?.total_lots ?? 0} lotes en el periodo
          </p>
        </div>

        {hist.data && hist.data.buckets.length > 0 ? (
          <>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hist.data.buckets}
                  margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="classification" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === 'pct' ? `${v}%` : v.toLocaleString('es')
                    }
                  />
                  <Legend />
                  <Bar dataKey="lots" fill="#7c3aed" name="Nº lotes" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Clasificación</th>
                    <th className="px-4 py-2 text-right">Lotes</th>
                    <th className="px-4 py-2 text-right">Libras</th>
                    <th className="px-4 py-2 text-right">% del total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hist.data.buckets.map((b) => (
                    <tr key={b.classification}>
                      <td className="px-4 py-2 font-medium text-slate-900">{b.classification}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{b.lots}</td>
                      <td className="px-4 py-2 text-right text-slate-700">
                        {Math.round(b.total_lbs).toLocaleString('es')}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-cea-700">
                        {b.pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            {hist.isLoading ? 'Cargando…' : 'Sin datos en este rango / filtro'}
          </div>
        )}
      </section>

      {/* Tendencia mensual de gramaje */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Evolución del gramaje promedio (g)
        </h2>
        {trend.data && trend.data.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend.data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="g" />
                <Tooltip formatter={(v: number) => `${v} g`} />
                <Line
                  type="monotone"
                  dataKey="avg_grammage"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400">
            {trend.isLoading ? 'Cargando…' : 'Sin datos'}
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">
        Nota: la distribución se calcula a partir del campo <code>average_classification_code</code>{' '}
        del análisis. Cuando se capturen los R-CC-034 individuales, esta misma pantalla podrá
        mostrar el histograma fino por gramaje (5–52 g) de cada lote.
      </p>
    </main>
  )
}

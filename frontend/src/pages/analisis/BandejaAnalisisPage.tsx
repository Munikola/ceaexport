import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ClipboardList, Clock, Image as ImageIcon, Package, Search } from 'lucide-react'
import { api } from '../../api/client'
import LotPhotosModal from '../../components/LotPhotosModal'
import type { BoardState, LotBoardRow } from '../../types/domain'

interface TabDef {
  state: BoardState | 'todos'
  label: string
}

const TABS: TabDef[] = [
  { state: 'todos', label: 'Todos' },
  { state: 'pendiente', label: 'Pendientes' },
  { state: 'en_analisis', label: 'En análisis' },
  { state: 'liberado', label: 'Liberados' },
  { state: 'rechazado', label: 'Rechazados' },
]

export default function BandejaAnalisisPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabDef['state']>('todos')
  const [filter, setFilter] = useState('')
  const [photosLot, setPhotosLot] = useState<{ id: number; code: string } | null>(null)

  const q = useQuery({
    queryKey: ['analyses', 'board'],
    queryFn: async () => (await api.get<LotBoardRow[]>('/api/analyses/board')).data,
    refetchInterval: 30_000,
  })

  // Conteo por estado para los badges de los tabs
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: 0 }
    for (const r of q.data ?? []) {
      c.todos = (c.todos ?? 0) + 1
      c[r.board_state] = (c[r.board_state] ?? 0) + 1
    }
    return c
  }, [q.data])

  const rows = useMemo(() => {
    let list = q.data ?? []
    if (activeTab !== 'todos') list = list.filter((r) => r.board_state === activeTab)
    const f = filter.trim().toLowerCase()
    if (f) {
      list = list.filter(
        (r) =>
          r.lot_code.toLowerCase().includes(f) ||
          (r.supplier_name ?? '').toLowerCase().includes(f) ||
          (r.origin_name ?? '').toLowerCase().includes(f),
      )
    }
    return list
  }, [q.data, activeTab, filter])

  const open = (row: LotBoardRow) => {
    if (row.analysis_id) navigate(`/analisis/${row.analysis_id}`)
    else navigate(`/analisis/lote/${row.lot_id}`)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <h1 className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4 text-emerald-700" />
            Muestras de lotes
          </h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Muestras de lotes</h2>
          <p className="text-sm text-slate-500">
            Pulsa una fila para abrir su ficha de análisis.
          </p>
        </div>

        {/* Filtro / búsqueda */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filtrar por código, proveedor o procedencia…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm font-medium shadow-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30"
            />
          </div>
        </div>

        {/* Tabs por estado */}
        <div className="mb-3 flex flex-wrap gap-1.5 border-b border-slate-200">
          {TABS.map((t) => {
            const active = activeTab === t.state
            const count = counts[t.state] ?? 0
            return (
              <button
                key={t.state}
                type="button"
                onClick={() => setActiveTab(t.state)}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'border-cea-700 text-cea-800'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {t.label}
                <span
                  className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    active ? 'bg-cea-100 text-cea-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {q.isLoading && <p className="py-12 text-center text-sm text-slate-500">Cargando…</p>}
        {q.isError && (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Error al cargar la bandeja.
          </p>
        )}

        {q.data && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Package className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">
              {filter
                ? 'Ningún lote coincide con el filtro.'
                : activeTab === 'pendiente'
                  ? 'No hay lotes pendientes de análisis.'
                  : 'No hay lotes en este estado.'}
            </p>
          </div>
        )}

        {q.data && rows.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Recepción</th>
                  <th className="px-4 py-3 font-semibold">Producto</th>
                  <th className="px-4 py-3 font-semibold">Origen</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Analista</th>
                  <th className="px-3 py-3 text-center font-semibold">Archivos</th>
                  <th className="px-4 py-3 text-right font-semibold">Lbs</th>
                  <th className="px-4 py-3 text-right">{/* acción */}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.lot_id}
                    onClick={() => open(row)}
                    className="cursor-pointer border-t border-slate-100 hover:bg-cea-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-base font-bold text-slate-900">
                        {row.lot_code}
                      </div>
                      <div className="text-xs text-slate-400">/{row.lot_year}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.reception_date}
                      {row.arrival_time && (
                        <div className="text-xs text-slate-400">
                          {row.arrival_time.slice(0, 5)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {row.product_type ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{row.supplier_name ?? '—'}</div>
                      {row.origin_name && (
                        <div className="text-xs text-slate-400">
                          {row.origin_name}
                          {row.psc && ` · ${row.psc}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <BoardStatePill
                        state={row.board_state as BoardState}
                        decision={row.decision_name}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.analyst_name ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {row.attachment_count > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setPhotosLot({ id: row.lot_id, code: row.lot_code })
                          }}
                          title={`Ver ${row.attachment_count} archivo(s)`}
                          className="inline-flex items-center gap-1 rounded-full border border-cea-200 bg-cea-50 px-2 py-0.5 text-xs font-semibold text-cea-700 transition hover:border-cea-500 hover:bg-cea-100"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          {row.attachment_count}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {row.total_lbs?.toLocaleString('es-EC', { maximumFractionDigits: 0 }) ??
                        '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.board_state === 'pendiente' && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <Clock className="h-3 w-3" />
                          {(row.hours_since_reception ?? 0).toFixed(1)} h
                        </span>
                      )}
                      <span className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-cea-500 hover:bg-cea-50">
                        Abrir
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {photosLot && (
        <LotPhotosModal
          lotId={photosLot.id}
          lotCode={photosLot.code}
          onClose={() => setPhotosLot(null)}
        />
      )}
    </div>
  )
}

function BoardStatePill({
  state,
  decision,
}: {
  state: BoardState | string
  decision: string | null
}) {
  const map: Record<string, { bg: string; label: string }> = {
    pendiente: { bg: 'bg-slate-100 text-slate-700 ring-slate-200', label: 'pendiente' },
    en_analisis: { bg: 'bg-amber-100 text-amber-800 ring-amber-200', label: 'en análisis' },
    liberado: { bg: 'bg-emerald-100 text-emerald-800 ring-emerald-200', label: 'liberado' },
    rechazado: { bg: 'bg-red-100 text-red-800 ring-red-300', label: 'rechazado' },
  }
  const cfg = map[state] ?? map.pendiente
  return (
    <div className="leading-tight">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${cfg.bg}`}
      >
        {cfg.label}
      </span>
      {decision && (
        <div className="mt-0.5 text-[10px] text-slate-500">{decision}</div>
      )}
    </div>
  )
}

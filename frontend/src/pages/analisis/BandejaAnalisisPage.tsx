import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardList,
  Clock,
  Image as ImageIcon,
  Package,
  Search,
  Trash2,
} from 'lucide-react'
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
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabDef['state']>('todos')
  const [filter, setFilter] = useState('')
  const [photosLot, setPhotosLot] = useState<{ id: number; code: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<
    { analysisId: number; lotCode: string } | null
  >(null)

  type SortKey =
    | 'lot_code'
    | 'reception_date'
    | 'product_type'
    | 'supplier_name'
    | 'board_state'
    | 'analyst_name'
    | 'attachment_count'
    | 'total_lbs'
  const [sortBy, setSortBy] = useState<SortKey>('reception_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      // Para fechas/cantidades por defecto descendente; para textos ascendente
      setSortDir(
        ['reception_date', 'attachment_count', 'total_lbs'].includes(key)
          ? 'desc'
          : 'asc',
      )
    }
  }

  const removeAnalysis = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/analyses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyses', 'board'] })
      setConfirmDelete(null)
    },
  })

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
    // Ordenar
    const sorted = [...list].sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      // null/undefined al final
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [q.data, activeTab, filter, sortBy, sortDir])

  const open = (row: LotBoardRow) => {
    if (row.analysis_id) navigate(`/analisis/${row.analysis_id}`)
    else navigate(`/analisis/lote/${row.lot_id}`)
  }

  return (
    <>
    <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Muestras</h1>
          <p className="text-sm text-slate-500">
            Pulsa una fila para abrir su ficha de análisis.
          </p>
        </div>
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
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="lot_code" onClick={toggleSort}>Código</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="reception_date" onClick={toggleSort}>Recepción</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="product_type" onClick={toggleSort}>Producto</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="supplier_name" onClick={toggleSort}>Origen</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="board_state" onClick={toggleSort}>Estado</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="analyst_name" onClick={toggleSort}>Analista</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="attachment_count" onClick={toggleSort} align="center">
                    <ImageIcon className="h-4 w-4" />
                    <span>Archivos</span>
                  </SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="total_lbs" onClick={toggleSort} align="right">Lbs</SortTh>
                  <th className="px-4 py-4 text-right">{/* acción */}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.lot_id}
                    onClick={() => open(row)}
                    className="group cursor-pointer border-t border-slate-100 hover:bg-cea-50/50"
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
                    <td className="w-[180px] whitespace-nowrap px-4 py-3 pr-6 text-right">
                      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                        {row.board_state === 'pendiente' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                            <Clock className="h-3 w-3" />
                            {(row.hours_since_reception ?? 0).toFixed(1)} h
                          </span>
                        )}
                        {row.analysis_id && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmDelete({
                                analysisId: row.analysis_id!,
                                lotCode: row.lot_code,
                              })
                            }}
                            title="Eliminar análisis"
                            className="rounded-md border border-red-200 bg-red-50 p-1.5 text-red-700 transition hover:border-red-400 hover:bg-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-cea-300 bg-cea-50 px-4 py-1.5 text-xs font-semibold text-cea-800 shadow-sm transition group-hover:border-cea-500 group-hover:bg-cea-100">
                          Abrir →
                        </span>
                      </div>
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

      {/* Modal de confirmación de borrado */}
      {confirmDelete && (
        <div
          onClick={() => !removeAnalysis.isPending && setConfirmDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="flex items-start gap-3 border-b border-slate-200 bg-red-50 px-5 py-4">
              <div className="rounded-lg bg-red-100 p-2 ring-1 ring-red-200">
                <Trash2 className="h-5 w-5 text-red-700" strokeWidth={2.5} />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-900">
                  ¿Eliminar el análisis del lote {confirmDelete.lotCode}?
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Esta acción no se puede deshacer. Se borrarán todos los datos del
                  análisis: defectos, organoléptico, mini-histograma y archivos asociados.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={removeAnalysis.isPending}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => removeAnalysis.mutate(confirmDelete.analysisId)}
                disabled={removeAnalysis.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:bg-red-400"
              >
                <Trash2 className="h-4 w-4" />
                {removeAnalysis.isPending ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function SortTh<K extends string>({
  k,
  sortBy,
  sortDir,
  onClick,
  align = 'left',
  children,
}: {
  k: K
  sortBy: K
  sortDir: 'asc' | 'desc'
  onClick: (k: K) => void
  align?: 'left' | 'center' | 'right'
  children: React.ReactNode
}) {
  const active = sortBy === k
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  const justify =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
  return (
    <th className={`px-4 py-5 font-bold uppercase tracking-wider text-${align}`}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`group inline-flex w-full items-center gap-1.5 ${justify} text-base ${
          active ? 'text-cea-800' : 'text-slate-600 hover:text-cea-700'
        }`}
      >
        <span>{children}</span>
        <Icon
          className={`h-4 w-4 transition ${active ? '' : 'opacity-30 group-hover:opacity-70'}`}
          strokeWidth={2.5}
        />
      </button>
    </th>
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

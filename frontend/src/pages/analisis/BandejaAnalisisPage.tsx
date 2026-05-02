import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown, ArrowUp, ArrowUpDown,
  ClipboardList, Clock, FlaskConical, CheckCircle2, XCircle,
  Image as ImageIcon, Search, Trash2, Plus, Download, Printer, Settings2,
  ChevronLeft, ChevronRight, AlertTriangle,
} from 'lucide-react'
import { api } from '../../api/client'
import LotPhotosModal from '../../components/LotPhotosModal'
import type { BoardState, LotBoardRow } from '../../types/domain'
import EmptyState from '../../components/EmptyState'

type SortKey =
  | 'lot_code' | 'reception_date' | 'product_type' | 'supplier_name'
  | 'board_state' | 'analyst_name' | 'attachment_count' | 'total_lbs'

type StateFilter = BoardState | 'todos'

const PAGE_SIZES = [15, 30, 50, 100] as const

const STATE_CARDS: { state: StateFilter; label: string; icon: typeof ClipboardList; color: string; bg: string }[] = [
  { state: 'todos',       label: 'Todas',       icon: ClipboardList, color: 'text-cea-600',     bg: 'bg-cea-50' },
  { state: 'pendiente',   label: 'Pendientes',  icon: Clock,         color: 'text-amber-600',   bg: 'bg-amber-50' },
  { state: 'en_analisis', label: 'En análisis', icon: FlaskConical,  color: 'text-purple-600',  bg: 'bg-purple-50' },
  { state: 'liberado',    label: 'Liberadas',   icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { state: 'rechazado',   label: 'Rechazadas',  icon: XCircle,       color: 'text-rose-600',    bg: 'bg-rose-50' },
]

export default function BandejaAnalisisPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ─── estado ───
  const [activeState, setActiveState] = useState<StateFilter>('todos')
  const [search, setSearch] = useState('')
  const [photosLot, setPhotosLot] = useState<{ id: number; code: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ analysisId: number; lotCode: string } | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('reception_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [pageSize, setPageSize] = useState<number>(15)
  const [page, setPage] = useState<number>(1)

  // Filtros avanzados
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [productFilter, setProductFilter] = useState<string>('')
  const [supplierFilter, setSupplierFilter] = useState<string>('')
  const [analystFilter, setAnalystFilter] = useState<string>('')
  const [lbsMin, setLbsMin] = useState<string>('')
  const [lbsMax, setLbsMax] = useState<string>('')

  // ─── data ───
  const q = useQuery({
    queryKey: ['analyses', 'board'],
    queryFn: async () => (await api.get<LotBoardRow[]>('/api/analyses/board')).data,
    refetchInterval: 30_000,
  })

  const removeAnalysis = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/analyses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyses', 'board'] })
      setConfirmDelete(null)
    },
  })

  // Conteo por estado
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: 0 }
    for (const r of q.data ?? []) {
      c.todos = (c.todos ?? 0) + 1
      c[r.board_state] = (c[r.board_state] ?? 0) + 1
    }
    return c
  }, [q.data])

  // Catálogos derivados de la data (para los dropdowns del sidebar)
  const productOptions = useMemo(
    () => Array.from(new Set((q.data ?? []).map((r) => r.product_type).filter(Boolean) as string[])),
    [q.data],
  )
  const supplierOptions = useMemo(
    () => Array.from(new Set((q.data ?? []).map((r) => r.supplier_name).filter(Boolean) as string[])).sort(),
    [q.data],
  )
  const analystOptions = useMemo(
    () => Array.from(new Set((q.data ?? []).map((r) => r.analyst_name).filter(Boolean) as string[])).sort(),
    [q.data],
  )

  // ─── filtrado + sort ───
  const filteredRows = useMemo(() => {
    let list = q.data ?? []
    if (activeState !== 'todos') list = list.filter((r) => r.board_state === activeState)
    const f = search.trim().toLowerCase()
    if (f) {
      list = list.filter(
        (r) =>
          r.lot_code.toLowerCase().includes(f) ||
          (r.supplier_name ?? '').toLowerCase().includes(f) ||
          (r.origin_name ?? '').toLowerCase().includes(f),
      )
    }
    if (dateFrom) list = list.filter((r) => (r.reception_date ?? '') >= dateFrom)
    if (dateTo) list = list.filter((r) => (r.reception_date ?? '') <= dateTo)
    if (productFilter) list = list.filter((r) => r.product_type === productFilter)
    if (supplierFilter) list = list.filter((r) => r.supplier_name === supplierFilter)
    if (analystFilter) list = list.filter((r) => r.analyst_name === analystFilter)
    if (lbsMin) {
      const m = Number(lbsMin)
      list = list.filter((r) => (r.total_lbs ?? 0) >= m)
    }
    if (lbsMax) {
      const m = Number(lbsMax)
      list = list.filter((r) => (r.total_lbs ?? 0) <= m)
    }
    // Sort
    return [...list].sort((a, b) => {
      const av = a[sortBy]
      const bv = b[sortBy]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = 0
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
      else cmp = String(av).localeCompare(String(bv), 'es', { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [q.data, activeState, search, sortBy, sortDir, dateFrom, dateTo, productFilter, supplierFilter, analystFilter, lbsMin, lbsMax])

  // Paginación
  const totalRows = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const safePage = Math.min(page, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageRows = filteredRows.slice(pageStart, pageStart + pageSize)

  // KPIs del periodo (sobre filteredRows)
  const periodSummary = useMemo(() => {
    const total = filteredRows.length
    const liberadas = filteredRows.filter((r) => r.board_state === 'liberado').length
    const rechazadas = filteredRows.filter((r) => r.board_state === 'rechazado').length
    const en_analisis = filteredRows.filter((r) => r.board_state === 'en_analisis').length
    const pendientes = filteredRows.filter((r) => r.board_state === 'pendiente').length
    return { total, liberadas, rechazadas, en_analisis, pendientes }
  }, [filteredRows])

  // ─── handlers ───
  const open = (row: LotBoardRow) => {
    if (row.analysis_id) navigate(`/analisis/${row.analysis_id}`)
    else navigate(`/analisis/lote/${row.lot_id}`)
  }

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setSortDir(['reception_date', 'attachment_count', 'total_lbs'].includes(key) ? 'desc' : 'asc')
    }
  }

  const clearFilters = () => {
    setDateFrom(''); setDateTo('')
    setProductFilter(''); setSupplierFilter(''); setAnalystFilter('')
    setLbsMin(''); setLbsMax('')
    setActiveState('todos'); setSearch('')
  }

  const exportCSV = () => {
    const headers = ['Código', 'Año', 'Recepción', 'Producto', 'Origen', 'Procedencia', 'Estado', 'Analista', 'Decisión', 'Lbs', 'Archivos']
    const lines = filteredRows.map((r) => [
      r.lot_code, r.lot_year, r.reception_date ?? '',
      r.product_type ?? '', r.supplier_name ?? '', r.origin_name ?? '',
      r.board_state, r.analyst_name ?? '', r.decision_name ?? '',
      r.total_lbs ?? '', r.attachment_count,
    ])
    const csv = [headers, ...lines]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `muestras-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // ─── render ───
  return (
    <>
    <main className="mx-auto max-w-[1500px] space-y-5 px-3 py-5 sm:px-5">
      {/* ── Header ─── */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Muestras</h1>
            <p className="text-sm text-slate-500">Listado de fichas de análisis</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/recepcion')}
          className="flex items-center gap-1.5 rounded-lg bg-cea-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cea-800"
        >
          <Plus className="h-4 w-4" /> Nueva muestra
        </button>
      </header>

      {/* ── Buscador + acciones ─── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por código, proveedor, procedencia…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
          />
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      {/* ── KPIs (clickables) ─── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATE_CARDS.map((card) => {
          const Icon = card.icon
          const isActive = activeState === card.state
          return (
            <button
              key={card.state}
              onClick={() => { setActiveState(card.state); setPage(1) }}
              className={`fade-in flex items-start gap-3 rounded-xl border bg-white p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isActive ? 'border-cea-700 ring-2 ring-cea-500/20' : 'border-slate-200'
              }`}
            >
              <div className={`shrink-0 rounded-lg p-2.5 ${card.bg}`}>
                <Icon className={`h-5 w-5 ${card.color}`} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-500">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {counts[card.state] ?? 0}
                </p>
                <p className="text-[11px] text-slate-400">muestras</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Layout 2 columnas: tabla + sidebar ─── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Tabla */}
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="lot_code" onClick={toggleSort}>Código</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="reception_date" onClick={toggleSort}>Recepción</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="product_type" onClick={toggleSort}>Producto</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="supplier_name" onClick={toggleSort}>Origen</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="board_state" onClick={toggleSort}>Estado</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="analyst_name" onClick={toggleSort}>Analista</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="attachment_count" onClick={toggleSort} align="center">Archivos</SortTh>
                  <SortTh sortBy={sortBy} sortDir={sortDir} k="total_lbs" onClick={toggleSort} align="right">Lbs</SortTh>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-12">
                    <EmptyState loading variant="table" />
                  </td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12">
                    <EmptyState
                      variant="search"
                      title="Sin resultados"
                      description="Cambia los filtros o el rango de búsqueda"
                    />
                  </td></tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.lot_id} className="table-row-hover">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => open(row)}
                          className="text-left font-mono font-semibold text-slate-900 hover:text-cea-700"
                        >
                          {row.lot_code}
                        </button>
                        <div className="text-[11px] text-slate-400">/{row.lot_year}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.reception_date && (
                          <div className="text-xs text-slate-700">
                            {new Date(row.reception_date).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                          </div>
                        )}
                        {row.arrival_time && (
                          <div className="text-[11px] text-slate-400">{row.arrival_time.slice(0, 5)}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {row.product_type && <ProductPill type={row.product_type} />}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium text-slate-800">{row.supplier_name ?? '—'}</div>
                        {row.origin_name && (
                          <div className="text-[11px] text-slate-400">{row.origin_name} {row.psc && `· ${row.psc}`}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StateBadge state={row.board_state} decision={row.decision_name} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-700">{row.analyst_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center">
                        {row.attachment_count > 0 ? (
                          <button
                            onClick={() => setPhotosLot({ id: row.lot_id, code: row.lot_code })}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                          >
                            <ImageIcon className="h-3 w-3" /> {row.attachment_count}
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-sm text-slate-700">
                        {row.total_lbs != null ? Math.round(row.total_lbs).toLocaleString('es') : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex gap-1">
                          {row.analysis_id && (
                            <button
                              onClick={() =>
                                setConfirmDelete({ analysisId: row.analysis_id!, lotCode: row.lot_code })
                              }
                              className="rounded p-1.5 text-rose-500 hover:bg-rose-50"
                              title="Eliminar análisis"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => open(row)}
                            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-cea-300 hover:bg-cea-50 hover:text-cea-700"
                          >
                            Abrir <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalRows > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs">
              <div className="text-slate-500">
                Mostrando <span className="font-medium text-slate-700">{pageStart + 1}</span> a{' '}
                <span className="font-medium text-slate-700">{Math.min(pageStart + pageSize, totalRows)}</span> de{' '}
                <span className="font-medium text-slate-700">{totalRows}</span> resultados
              </div>
              <Pagination current={safePage} total={totalPages} onChange={setPage} />
              <div className="flex items-center gap-2 text-slate-500">
                Mostrar
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {/* Filtros */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Filtros</h3>
              <button onClick={clearFilters} className="text-[11px] font-medium text-cea-600 hover:text-cea-800">
                Limpiar
              </button>
            </div>

            <div className="space-y-3">
              <FilterField label="Rango de fechas">
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="date" value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  />
                  <input
                    type="date" value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
              </FilterField>

              <FilterField label="Producto">
                <select
                  value={productFilter}
                  onChange={(e) => { setProductFilter(e.target.value); setPage(1) }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Todos</option>
                  {productOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </FilterField>

              <FilterField label="Origen / Proveedor">
                <select
                  value={supplierFilter}
                  onChange={(e) => { setSupplierFilter(e.target.value); setPage(1) }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Todos</option>
                  {supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FilterField>

              <FilterField label="Analista">
                <select
                  value={analystFilter}
                  onChange={(e) => { setAnalystFilter(e.target.value); setPage(1) }}
                  className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="">Todos</option>
                  {analystOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </FilterField>

              <FilterField label="Rango de libras">
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number" placeholder="Min"
                    value={lbsMin}
                    onChange={(e) => { setLbsMin(e.target.value); setPage(1) }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  />
                  <input
                    type="number" placeholder="Máx"
                    value={lbsMax}
                    onChange={(e) => { setLbsMax(e.target.value); setPage(1) }}
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
                  />
                </div>
              </FilterField>
            </div>
          </section>

          {/* Resumen del periodo */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Resumen del periodo</h3>
            <dl className="space-y-1.5 text-xs">
              <SummaryLine label="Total muestras" value={periodSummary.total.toLocaleString('es')} />
              <SummaryLine
                label="Liberadas"
                value={`${periodSummary.liberadas} (${periodSummary.total ? Math.round(periodSummary.liberadas / periodSummary.total * 100) : 0}%)`}
                color="text-emerald-600"
              />
              <SummaryLine
                label="Rechazadas"
                value={`${periodSummary.rechazadas} (${periodSummary.total ? Math.round(periodSummary.rechazadas / periodSummary.total * 100) : 0}%)`}
                color="text-rose-600"
              />
              <SummaryLine label="En análisis" value={periodSummary.en_analisis.toLocaleString('es')} />
              <SummaryLine label="Pendientes" value={periodSummary.pendientes.toLocaleString('es')} />
            </dl>
          </section>

          {/* Acciones rápidas */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Acciones rápidas</h3>
            <div className="space-y-1.5">
              <ActionLink icon={Download} label="Exportar listado" onClick={exportCSV} />
              <ActionLink icon={Printer} label="Imprimir listado" onClick={() => window.print()} />
              <ActionLink icon={Settings2} label="Configurar columnas" onClick={() => alert('Próximamente: configurar columnas')} disabled />
            </div>
          </section>
        </aside>
      </div>

      {/* Footer pequeño */}
      <footer className="flex items-center justify-between border-t border-slate-200 pt-4 text-[11px] text-slate-400">
        <span>© {new Date().getFullYear()} CEA EXPORT — Control de Calidad</span>
        <span>Versión 0.1.0</span>
      </footer>
    </main>

    {/* Modal de fotos */}
    {photosLot && (
      <LotPhotosModal lotId={photosLot.id} lotCode={photosLot.code} onClose={() => setPhotosLot(null)} />
    )}

    {/* Modal de confirmación de borrado */}
    {confirmDelete && (
      <div
        onClick={() => !removeAnalysis.isPending && setConfirmDelete(null)}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <div onClick={(e) => e.stopPropagation()} className="fade-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="flex items-start gap-3 border-b border-slate-200 bg-rose-50 px-5 py-4">
            <div className="rounded-lg bg-rose-100 p-2 ring-1 ring-rose-200">
              <Trash2 className="h-5 w-5 text-rose-700" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold text-slate-900">
                ¿Eliminar el análisis del lote {confirmDelete.lotCode}?
              </h2>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-600">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                Esto borra el análisis y sus muestreos asociados. El lote vuelve al estado "pendiente".
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3">
            <button
              onClick={() => setConfirmDelete(null)}
              disabled={removeAnalysis.isPending}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              onClick={() => removeAnalysis.mutate(confirmDelete.analysisId)}
              disabled={removeAnalysis.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
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

// ─── subcomponentes ───

function SortTh<K extends string>({
  k, sortBy, sortDir, onClick, align = 'left', children,
}: {
  k: K; sortBy: K; sortDir: 'asc' | 'desc'
  onClick: (k: K) => void
  align?: 'left' | 'center' | 'right'
  children: React.ReactNode
}) {
  const isActive = sortBy === k
  const Icon = !isActive ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th className={`px-4 py-3 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
      <button
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 hover:text-slate-700 ${isActive ? 'text-slate-900' : ''}`}
      >
        {children}
        <Icon className={`h-3 w-3 ${isActive ? 'text-cea-700' : 'text-slate-400'}`} />
      </button>
    </th>
  )
}

function ProductPill({ type }: { type: string }) {
  const isCola = type === 'COLA'
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
      isCola ? 'bg-purple-100 text-purple-700' : 'bg-cea-100 text-cea-700'
    }`}>
      {type}
    </span>
  )
}

function StateBadge({ state, decision }: { state: BoardState | string; decision: string | null }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    pendiente:    { label: 'Pendiente',   bg: 'bg-amber-100',   text: 'text-amber-800' },
    en_analisis:  { label: 'En análisis', bg: 'bg-purple-100',  text: 'text-purple-800' },
    liberado:     { label: 'Liberado',    bg: 'bg-emerald-100', text: 'text-emerald-800' },
    rechazado:    { label: 'Rechazado',   bg: 'bg-rose-100',    text: 'text-rose-800' },
  }
  const cfg = config[state] ?? { label: state, bg: 'bg-slate-100', text: 'text-slate-700' }
  return (
    <div>
      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
      {decision && (
        <div className="mt-0.5 text-[10px] text-slate-500">{decision}</div>
      )}
    </div>
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
    </div>
  )
}

function SummaryLine({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-semibold tabular-nums ${color ?? 'text-slate-900'}`}>{value}</dd>
    </div>
  )
}

function ActionLink({
  icon: Icon, label, onClick, disabled,
}: {
  icon: typeof Download
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium transition ${
        disabled
          ? 'cursor-not-allowed text-slate-300'
          : 'text-slate-700 hover:bg-slate-50 hover:text-cea-700'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function Pagination({
  current, total, onChange,
}: {
  current: number
  total: number
  onChange: (p: number) => void
}) {
  if (total <= 1) return null
  const numbers = paginationNumbers(current, total)
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      {numbers.map((n, i) =>
        n === '…' ? (
          <span key={i} className="px-1 text-slate-400">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onChange(n as number)}
            className={`min-w-[24px] rounded px-1.5 py-0.5 text-xs font-medium ${
              n === current
                ? 'bg-cea-700 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {n}
          </button>
        )
      )}
      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function paginationNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  if (current > 4) out.push('…')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) out.push(i)
  if (current < total - 3) out.push('…')
  out.push(total)
  return out
}

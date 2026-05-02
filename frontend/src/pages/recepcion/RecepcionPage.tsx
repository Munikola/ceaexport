import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import {
  ChevronLeft,
  ArrowDownToLine,
  Truck,
  ClipboardCheck,
  Package,
  Snowflake,
  SprayCan,
  Thermometer,
  Camera,
  Pencil,
  Trash2,
  Copy,
  Plus,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Calendar,
  ScanLine,
} from 'lucide-react'

import { api } from '../../api/client'
import type { ReceptionCreate, ReceptionRead } from '../../types/domain'
import CatalogSelect from '../../components/CatalogSelect'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'
import { useCatalog } from '../../hooks/useCatalogs'
import ScoreDonut from '../../components/ScoreDonut'
import StarRating from '../../components/StarRating'
import LotEditModal, { type LotDraft } from './LotEditModal'

// ───────── helpers ─────────

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20'

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}
function nowHM(): string {
  return new Date().toTimeString().slice(0, 5)
}
function freshDefaults(): Partial<ReceptionCreate> {
  return {
    reception_date: isoToday(),
    arrival_time: nowHM(),
  }
}

const STEPS = [
  { id: 'datos',     label: 'Datos llegada',      icon: Calendar },
  { id: 'camion',    label: 'Información camión', icon: Truck },
  { id: 'inspeccion',label: 'Inspección',         icon: ClipboardCheck },
  { id: 'lotes',     label: 'Lotes',              icon: Package },
] as const

type StepId = typeof STEPS[number]['id']

// ───────── página ─────────

export default function RecepcionPage() {
  const [reception, setReception] = useState<Partial<ReceptionCreate>>(freshDefaults)
  const [lots, setLots] = useState<LotDraft[]>([])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [activeStep, setActiveStep] = useState<StepId>('datos')
  const [lastSaved, setLastSaved] = useState<{ id: number; lotCount: number } | null>(null)

  // Catálogos para mostrar nombres en el panel resumen y la tabla de lotes
  const plants = useCatalog('plants')
  const logistics = useCatalog('logistics-companies')
  const trucks = useCatalog('trucks')
  const drivers = useCatalog('drivers')
  const suppliers = useCatalog('suppliers')

  const submit = useMutation({
    mutationFn: async (payload: ReceptionCreate) =>
      (await api.post<ReceptionRead>('/api/receptions', payload)).data,
  })

  const set = <K extends keyof ReceptionCreate>(k: K, v: ReceptionCreate[K] | null) =>
    setReception((prev) => ({ ...prev, [k]: v }))

  // ─── score 0-100 ───
  const score = useMemo(() => calculateScore(reception, lots), [reception, lots])

  // ─── condiciones para el banner de riesgo ───
  const conditionsTruck = useCatalog('condition-levels-truck')
  const conditionsIce = useCatalog('condition-levels-ice')
  const conditionsHyg = useCatalog('condition-levels-hygiene')

  const truckCond = conditionsTruck.data?.find((c) => c.id === reception.truck_condition_id)
  const iceCond = conditionsIce.data?.find((c) => c.id === reception.ice_condition_id)
  const hygCond = conditionsHyg.data?.find((c) => c.id === reception.hygiene_condition_id)

  const tempOutOfRange =
    reception.arrival_temperature !== null &&
    reception.arrival_temperature !== undefined &&
    (Number(reception.arrival_temperature) < 0 || Number(reception.arrival_temperature) > 4)

  const isBadCondition = (name?: string) => {
    if (!name) return false
    const n = name.toLowerCase()
    return n.includes('mala') || n.includes('malo') || n.includes('insuficiente') || n.includes('sin hielo')
  }
  const hasRisk = tempOutOfRange ||
    isBadCondition(truckCond?.name) ||
    isBadCondition(iceCond?.name) ||
    isBadCondition(hygCond?.name)

  // ─── handlers de lotes ───
  const addLot = () => {
    setEditingIdx(null)
    setCreating(true)
  }
  const editLot = (idx: number) => {
    setEditingIdx(idx)
    setCreating(false)
  }
  const removeLot = (idx: number) => {
    if (!confirm(`¿Eliminar el lote #${idx + 1}?`)) return
    setLots(lots.filter((_, i) => i !== idx))
  }
  const copyLastLot = () => {
    if (lots.length === 0) return
    const last = lots[lots.length - 1]
    setLots([...lots, { ...last, lot_code: '', client_lot_code: '' }])
    setActiveStep('lotes')
  }
  const saveLotFromModal = (lot: LotDraft) => {
    if (creating) {
      setLots([...lots, lot])
    } else if (editingIdx !== null) {
      setLots(lots.map((l, i) => (i === editingIdx ? lot : l)))
    }
    setCreating(false)
    setEditingIdx(null)
  }

  // ─── envío ───
  const canSubmit =
    !!reception.plant_id &&
    !!reception.reception_date &&
    lots.length > 0 &&
    lots.every((l) => !!l.lot_code && !!l.supplier_id && !!l.product_type && (l.received_lbs ?? 0) > 0)

  const handleSubmit = async (status: 'borrador' | 'final' = 'final') => {
    if (status === 'final' && !canSubmit) return
    const payload = {
      ...reception,
      lots: lots.map((l) => ({
        lot_code: l.lot_code!,
        supplier_id: l.supplier_id!,
        product_type: l.product_type!,
        client_lot_code: l.client_lot_code ?? null,
        lot_year: l.lot_year ?? null,
        lot_category_id: l.lot_category_id ?? null,
        origin_id: l.origin_id ?? null,
        pond_id: l.pond_id ?? null,
        fishing_date: l.fishing_date ?? null,
        chemical_id: l.chemical_id ?? null,
        treater_ids: l.treater_ids ?? [],
        observations: l.observations ?? null,
        received_lbs: l.received_lbs ?? null,
        boxes_count: l.boxes_count ?? null,
        bins_count: l.bins_count ?? null,
        delivery_index: l.delivery_index ?? 1,
      })),
    } as ReceptionCreate

    try {
      const created = await submit.mutateAsync(payload)
      setReception(freshDefaults())
      setLots([])
      setActiveStep('datos')
      setLastSaved({ id: created.reception_id, lotCount: created.reception_lots.length })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Error visible en el banner
    }
  }

  // ─── derivados de UI ───
  const plantName = plants.data?.find((p) => p.id === reception.plant_id)?.name ?? '—'
  const logisticsName = logistics.data?.find((l) => l.id === reception.logistics_company_id)?.name
  const truckPlate = trucks.data?.find((t) => t.id === reception.truck_id)?.name
  const driverName = drivers.data?.find((d) => d.id === reception.driver_id)?.name
  const totalLbs = lots.reduce((s, l) => s + (Number(l.received_lbs) || 0), 0)

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 px-3 py-5 sm:px-5">
      {/* ── Header con stepper + botones ──────────────────── */}
      <header>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => history.back()}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Volver"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                Nueva recepción de camión
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  En progreso
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSubmit('borrador')}
              disabled={submit.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowDownToLine className="h-4 w-4" />
              Guardar borrador
            </button>
            <button
              onClick={() => handleSubmit('final')}
              disabled={!canSubmit || submit.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-cea-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cea-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              <CheckCircle2 className="h-4 w-4" />
              {submit.isPending ? 'Guardando…' : 'Finalizar recepción'}
            </button>
          </div>
        </div>

        {/* Stepper */}
        <Stepper score={score} active={activeStep} onClick={setActiveStep} />
      </header>

      {/* ── Toast de éxito ──────────────────────────────────── */}
      {lastSaved && !submit.isPending && (
        <div className="fade-in flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <span>
              Recepción <strong>#{lastSaved.id}</strong> guardada con {lastSaved.lotCount} lote{lastSaved.lotCount !== 1 ? 's' : ''}.
            </span>
          </div>
          <button
            onClick={() => setLastSaved(null)}
            className="text-emerald-700 hover:text-emerald-900"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}

      {submit.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(submit.error as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
            'Error al guardar la recepción'}
        </div>
      )}

      {/* ── Layout 2 columnas ───────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* ─── Columna izquierda: bloques ─── */}
        <div className="space-y-5">
          {/* Bloque 1: Datos de llegada */}
          <Block num={1} title="Datos de llegada">
            <div className="grid gap-4 sm:grid-cols-3">
              <CatalogSelect
                catalog="plants"
                label="Planta"
                required
                value={reception.plant_id}
                onChange={(id) => set('plant_id', id)}
              />
              <Labeled label="Fecha de llegada" required>
                <input
                  type="date" required
                  value={reception.reception_date ?? ''}
                  onChange={(e) => set('reception_date', e.target.value)}
                  className={INPUT}
                />
              </Labeled>
              <Labeled label="Hora de llegada" required
                action={
                  <button
                    type="button"
                    onClick={() => set('arrival_time', nowHM())}
                    className="flex items-center gap-1 text-[11px] font-medium text-cea-700 hover:text-cea-800"
                  >
                    <Clock className="h-3 w-3" /> Usar hora actual
                  </button>
                }
              >
                <input
                  type="time" required
                  value={reception.arrival_time ?? ''}
                  onChange={(e) => set('arrival_time', e.target.value)}
                  className={INPUT}
                />
              </Labeled>
            </div>
          </Block>

          {/* Bloque 2: Información del camión */}
          <Block num={2} title="Información del camión">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Labeled label="Placa" required
                action={
                  <button
                    type="button"
                    title="Próximamente: escaneo automático de la placa"
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-400"
                  >
                    <ScanLine className="h-3 w-3" /> Escanear placa
                  </button>
                }
              >
                <CatalogAutocomplete
                  catalog="trucks"
                  value={reception.truck_id}
                  onChange={(id) => set('truck_id', id)}
                  createExtra={
                    reception.logistics_company_id
                      ? { logistics_company_id: reception.logistics_company_id }
                      : undefined
                  }
                />
              </Labeled>
              <CatalogAutocomplete
                catalog="logistics-companies"
                label="Empresa logística"
                value={reception.logistics_company_id}
                onChange={(id) => set('logistics_company_id', id)}
              />
              <CatalogAutocomplete
                catalog="drivers"
                label="Chofer"
                value={reception.driver_id}
                onChange={(id) => set('driver_id', id)}
              />
              <Labeled label="Guía de remisión">
                <input
                  type="text"
                  value={reception.remission_guide_number ?? ''}
                  onChange={(e) => set('remission_guide_number', e.target.value || null)}
                  className={INPUT}
                />
              </Labeled>
              <Labeled label="Carta de garantía">
                <input
                  type="text"
                  value={reception.warranty_letter_number ?? ''}
                  onChange={(e) => set('warranty_letter_number', e.target.value || null)}
                  className={INPUT}
                />
              </Labeled>
              <Labeled label="Temperatura llegada (°C)">
                <div className="relative">
                  <Thermometer className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="number" step="0.1"
                    value={reception.arrival_temperature ?? ''}
                    onChange={(e) =>
                      set('arrival_temperature', e.target.value ? Number(e.target.value) : null)
                    }
                    className={`${INPUT} pl-9 pr-32`}
                  />
                  {tempOutOfRange && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                      Fuera de rango
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Rango esperado: 0 °C – 4 °C</p>
              </Labeled>
            </div>
          </Block>

          {/* Bloque 3: Inspección */}
          <Block num={3} title="Inspección del camión">
            <div className="space-y-3">
              <ConditionRow
                icon={Truck}
                label="Estado del camión"
                catalog="condition-levels-truck"
                value={reception.truck_condition_id}
                onChange={(id) => set('truck_condition_id', id)}
              />
              <ConditionRow
                icon={Snowflake}
                label="Estado del hielo"
                catalog="condition-levels-ice"
                value={reception.ice_condition_id}
                onChange={(id) => set('ice_condition_id', id)}
              />
              <ConditionRow
                icon={SprayCan}
                label="Higiene"
                catalog="condition-levels-hygiene"
                value={reception.hygiene_condition_id}
                onChange={(id) => set('hygiene_condition_id', id)}
              />

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 hover:border-slate-400 hover:text-slate-700"
                  title="Próximamente: foto del camión"
                >
                  <Camera className="h-4 w-4" /> Añadir foto del camión
                </button>
                <p className="text-[11px] text-slate-400">(opcional)</p>
              </div>

              {hasRisk && (
                <div className="fade-in flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-sm font-semibold text-rose-900">
                      Riesgo de calidad detectado
                    </p>
                    <p className="text-xs text-rose-700">
                      Se recomienda tomar acciones correctivas antes de continuar con la recepción.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <Labeled label="Observaciones">
                  <textarea
                    rows={2}
                    value={reception.observations ?? ''}
                    onChange={(e) => set('observations', e.target.value || null)}
                    className={INPUT}
                  />
                </Labeled>
              </div>
            </div>
          </Block>

          {/* Bloque 4: Lotes */}
          <Block
            num={4}
            title={`Lotes del camión${lots.length > 0 ? ` (${lots.length})` : ''}`}
            action={
              <div className="flex gap-2">
                <button
                  onClick={copyLastLot}
                  disabled={lots.length === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Copy className="h-3.5 w-3.5" /> Copiar último lote
                </button>
                <button
                  onClick={addLot}
                  className="flex items-center gap-1.5 rounded-lg bg-cea-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cea-800"
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir lote
                </button>
              </div>
            }
          >
            {lots.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 py-10">
                <Package className="h-10 w-10 text-slate-300" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">Sin lotes registrados</p>
                  <p className="text-xs text-slate-400">Pulsa "Añadir lote" para empezar</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Lote</th>
                      <th className="px-3 py-2 text-left">Proveedor</th>
                      <th className="px-3 py-2 text-left">Producto</th>
                      <th className="px-3 py-2 text-right">Lbs</th>
                      <th className="px-3 py-2 text-right">K/B</th>
                      <th className="px-3 py-2 text-left">Calidad</th>
                      <th className="px-3 py-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lots.map((lot, idx) => (
                      <tr key={idx} className="table-row-hover">
                        <td className="px-3 py-2 text-xs text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => editLot(idx)}
                            className="font-mono font-medium text-cea-700 hover:underline"
                          >
                            {lot.lot_code || '— sin código —'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {suppliers.data?.find((s) => s.id === lot.supplier_id)?.name ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {lot.product_type ? (
                            <span className="rounded-md bg-cea-50 px-2 py-0.5 text-[11px] font-semibold text-cea-700">
                              {lot.product_type}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {lot.received_lbs ? Number(lot.received_lbs).toLocaleString('es') : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500">
                          {(lot.boxes_count ?? '—')} / {(lot.bins_count ?? '—')}
                        </td>
                        <td className="px-3 py-2">
                          <StarRating value={lot.quality_visual ?? 0} readOnly size={14} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex gap-1">
                            <button
                              onClick={() => editLot(idx)}
                              className="rounded p-1.5 text-slate-500 hover:bg-cea-50 hover:text-cea-700"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => removeLot(idx)}
                              className="rounded p-1.5 text-rose-500 hover:bg-rose-50"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 text-xs">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 font-medium text-slate-600">
                        {lots.length} lote{lots.length !== 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-cea-700">
                        {totalLbs.toLocaleString('es')}
                      </td>
                      <td colSpan={3} className="px-3 py-2 text-right text-slate-500">
                        Peso total
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Block>
        </div>

        {/* ─── Columna derecha: panel resumen sticky ─── */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {/* Score */}
            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Resumen de recepción
              </h3>
              <ScoreDonut score={score} />
              <p className="mt-2 text-[11px] text-slate-400">
                Recepción en progreso
              </p>
            </div>

            {/* Datos */}
            <div className="border-t border-slate-200 pt-3">
              <SummaryRow label="Planta" value={plantName} />
              <SummaryRow
                label="Fecha / Hora"
                value={`${reception.reception_date ?? '—'} ${reception.arrival_time ?? ''}`}
              />
              <SummaryRow label="Empresa logística" value={logisticsName ?? '—'} />
              <SummaryRow label="Placa" value={truckPlate ?? '—'} />
              <SummaryRow label="Chofer" value={driverName ?? '—'} />
              <SummaryRow
                label="Temperatura"
                value={
                  reception.arrival_temperature != null
                    ? `${reception.arrival_temperature} °C`
                    : '—'
                }
                badge={tempOutOfRange ? { label: 'Fuera de rango', tone: 'rose' } : undefined}
              />
            </div>

            {/* Condiciones */}
            <div className="border-t border-slate-200 pt-3">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Condiciones
              </h4>
              <CondBadge icon={Truck} label="Estado del camión" name={truckCond?.name} />
              <CondBadge icon={Snowflake} label="Hielo" name={iceCond?.name} />
              <CondBadge icon={SprayCan} label="Higiene" name={hygCond?.name} />
            </div>

            {/* Lotes */}
            <div className="border-t border-slate-200 pt-3">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Lotes
              </h4>
              <SummaryRow label="Total lotes" value={String(lots.length)} />
              <SummaryRow
                label="Peso total"
                value={`${totalLbs.toLocaleString('es')} lbs`}
              />
            </div>

            {!canSubmit && (
              <div className="flex items-start gap-2 rounded-lg border border-cea-200 bg-cea-50/50 p-3 text-xs text-cea-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Recuerda completar todos los campos para finalizar la recepción
                  correctamente.
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal de edición de lote */}
      {(creating || editingIdx !== null) && (
        <LotEditModal
          initial={editingIdx !== null ? lots[editingIdx] : { product_type: 'ENTERO', delivery_index: 1, treater_ids: [] }}
          index={editingIdx ?? lots.length}
          onSave={saveLotFromModal}
          onClose={() => {
            setCreating(false)
            setEditingIdx(null)
          }}
        />
      )}
    </main>
  )
}

// ─────────── Subcomponentes ───────────

function calculateScore(reception: Partial<ReceptionCreate>, lots: LotDraft[]): number {
  let s = 0
  // Datos completos (30 pts)
  if (reception.plant_id) s += 8
  if (reception.reception_date) s += 5
  if (reception.arrival_time) s += 5
  if (reception.truck_id) s += 6
  if (reception.driver_id) s += 6
  // Temperatura en rango (20 pts)
  const t = reception.arrival_temperature
  if (t !== null && t !== undefined) {
    if (t >= 0 && t <= 4) s += 20
    else if (t <= 6) s += 10
    else s += 2
  }
  // Estado camión (15 pts)
  if (reception.truck_condition_id) s += 15  // simplificación: cualquier valor da puntos completos
  // Estado hielo (15 pts)
  if (reception.ice_condition_id) s += 15
  // Higiene (15 pts)
  if (reception.hygiene_condition_id) s += 15
  // Lotes (5 pts)
  if (lots.length > 0 && lots.every((l) => l.lot_code && l.supplier_id && l.product_type && (l.received_lbs ?? 0) > 0)) s += 5
  return Math.min(s, 100)
}

function Stepper({
  score, active, onClick,
}: {
  score: number
  active: StepId
  onClick: (id: StepId) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {STEPS.map((s, i) => {
          const isActive = s.id === active
          const Icon = s.icon
          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onClick(s.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'border-cea-700 bg-cea-700 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white text-cea-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="hidden text-slate-300 sm:inline">—</span>}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-600">{score}% completado</span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background:
                score >= 75 ? '#16a34a' :
                score >= 50 ? '#f59e0b' : '#dc2626',
            }}
          />
        </div>
      </div>
    </div>
  )
}

function Block({
  num, title, action, children,
}: {
  num: number
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cea-700 text-xs font-bold text-white">
            {num}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Labeled({
  label, required, action, children,
}: {
  label: string
  required?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {action}
      </div>
      {children}
    </div>
  )
}

function ConditionRow({
  icon: Icon, label, catalog, value, onChange,
}: {
  icon: typeof Truck
  label: string
  catalog: 'condition-levels-truck' | 'condition-levels-ice' | 'condition-levels-hygiene'
  value: number | null | undefined
  onChange: (id: number | null) => void
}) {
  const q = useCatalog(catalog)
  return (
    <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[200px_1fr]">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Icon className="h-4 w-4 text-slate-500" /> {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(q.data ?? []).map((c) => {
          const selected = c.id === value
          const tone =
            c.name.toLowerCase().includes('mala') || c.name.toLowerCase().includes('malo') ||
            c.name.toLowerCase().includes('insuficiente') || c.name.toLowerCase().includes('sin hielo')
              ? 'bad'
              : c.name.toLowerCase().includes('regular') ? 'mid' : 'good'
          const baseClasses = selected
            ? tone === 'bad'  ? 'border-rose-600 bg-rose-50 text-rose-700'
            : tone === 'mid'  ? 'border-amber-500 bg-amber-50 text-amber-700'
            : tone === 'good' ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
            : 'border-slate-300 bg-slate-50 text-slate-700'
            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(selected ? null : c.id)}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${baseClasses}`}
            >
              {c.name}
              {selected && <CheckCircle2 className="h-3 w-3" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SummaryRow({
  label, value, badge,
}: {
  label: string
  value: string
  badge?: { label: string; tone: 'rose' | 'amber' | 'emerald' }
}) {
  const toneClass =
    badge?.tone === 'rose' ? 'bg-rose-100 text-rose-700' :
    badge?.tone === 'amber' ? 'bg-amber-100 text-amber-700' :
    'bg-emerald-100 text-emerald-700'
  return (
    <div className="flex items-start justify-between gap-2 py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="flex items-center gap-1.5 text-right font-medium text-slate-900">
        {value}
        {badge && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}>
            {badge.label}
          </span>
        )}
      </span>
    </div>
  )
}

function CondBadge({
  icon: Icon, label, name,
}: {
  icon: typeof Truck
  label: string
  name?: string
}) {
  const tone = !name ? 'none'
    : name.toLowerCase().includes('mala') || name.toLowerCase().includes('malo') ||
      name.toLowerCase().includes('insuficiente') || name.toLowerCase().includes('sin hielo') ? 'bad'
    : name.toLowerCase().includes('regular') ? 'mid'
    : 'good'
  const cls =
    tone === 'bad'  ? 'bg-rose-100 text-rose-700' :
    tone === 'mid'  ? 'bg-amber-100 text-amber-700' :
    tone === 'good' ? 'bg-emerald-100 text-emerald-700' :
    'bg-slate-100 text-slate-400'

  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="flex items-center gap-1.5 text-slate-600">
        <Icon className="h-3.5 w-3.5 text-slate-400" /> {label}
      </span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
        {name ?? 'Sin definir'}
      </span>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowLeft, Save, Truck, Snowflake, SprayCan, FileCheck, Thermometer, MapPin } from 'lucide-react'

import { api } from '../../api/client'
import type { LotInReceptionCreate, ReceptionCreate, ReceptionRead } from '../../types/domain'
import CatalogSelect from '../../components/CatalogSelect'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'
import { useCatalog } from '../../hooks/useCatalogs'
import Step2Lotes from './Step2Lotes'

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30'

function freshDefaults(): Partial<ReceptionCreate> {
  return {
    reception_date: new Date().toISOString().slice(0, 10),
    arrival_time: new Date().toTimeString().slice(0, 5),
  }
}

export default function RecepcionPage() {
  const navigate = useNavigate()

  const [reception, setReception] = useState<Partial<ReceptionCreate>>(freshDefaults)
  const [lots, setLots] = useState<Partial<LotInReceptionCreate>[]>([{}])
  const [lastSaved, setLastSaved] = useState<{ id: number; lotCount: number } | null>(null)

  const submit = useMutation({
    mutationFn: async (payload: ReceptionCreate) =>
      (await api.post<ReceptionRead>('/api/receptions', payload)).data,
  })

  const set = <K extends keyof ReceptionCreate>(k: K, v: ReceptionCreate[K] | null) =>
    setReception((prev) => ({ ...prev, [k]: v }))

  const canSubmit =
    !!reception.plant_id &&
    !!reception.reception_date &&
    lots.length > 0 &&
    lots.every(
      (l) => !!l.lot_code && !!l.supplier_id && !!l.product_type && (l.received_lbs ?? 0) > 0,
    )

  const handleSubmit = async () => {
    if (!canSubmit) return
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
      // Resetear el formulario para la siguiente recepción y mantenernos en /recepcion
      setReception(freshDefaults())
      setLots([{}])
      setLastSaved({ id: created.reception_id, lotCount: created.reception_lots.length })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // El error se muestra en el banner
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header sticky con guardar siempre visible */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <h1 className="text-base font-semibold">Nueva recepción</h1>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submit.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300"
          >
            <Save className="h-4 w-4" />
            {submit.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </header>

      {submit.isError && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {(submit.error as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              'Error al guardar'}
          </p>
        </div>
      )}

      {lastSaved && !submit.isPending && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
                ✓
              </span>
              <span>
                Recepción <strong>#{lastSaved.id}</strong> guardada
                {lastSaved.lotCount > 1 ? ` con ${lastSaved.lotCount} lotes` : ''}.
                Formulario listo para la siguiente.
              </span>
            </div>
            <button
              onClick={() => setLastSaved(null)}
              className="text-emerald-700 hover:text-emerald-900"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        {/* ── CABECERA: planta + fecha + hora ─────────────────────── */}
        <Card title="Recepción" icon={FileCheck}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Labeled label="Planta" required>
              <CatalogSelect
                catalog="plants"
                value={reception.plant_id}
                onChange={(id) => set('plant_id', id)}
                required
              />
            </Labeled>
            <Labeled label="Fecha de llegada" required>
              <input
                type="date"
                required
                value={reception.reception_date ?? ''}
                onChange={(e) => set('reception_date', e.target.value)}
                className={INPUT}
              />
            </Labeled>
            <Labeled label="Hora de llegada">
              <input
                type="time"
                value={reception.arrival_time ?? ''}
                onChange={(e) => set('arrival_time', e.target.value)}
                className={INPUT}
              />
            </Labeled>
          </div>
        </Card>

        {/* ── CAMIÓN ─────────────────────────────────────────────── */}
        <Card title="Camión" icon={Truck}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CatalogAutocomplete
              catalog="logistics-companies"
              label="Empresa logística"
              value={reception.logistics_company_id}
              onChange={(id) => set('logistics_company_id', id)}
            />
            <CatalogAutocomplete
              catalog="trucks"
              label="Placa"
              value={reception.truck_id}
              onChange={(id) => set('truck_id', id)}
              createExtra={
                reception.logistics_company_id
                  ? { logistics_company_id: reception.logistics_company_id }
                  : undefined
              }
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
                placeholder="Ej. 001-001-000123456"
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
            <Labeled label="Temperatura llegada (°C)" icon={Thermometer}>
              <input
                type="number"
                step="0.1"
                value={reception.arrival_temperature ?? ''}
                onChange={(e) =>
                  set('arrival_temperature', e.target.value ? Number(e.target.value) : null)
                }
                className={INPUT}
              />
            </Labeled>
          </div>
        </Card>

        {/* ── CONDICIONES (chips horizontales) ───────────────────── */}
        <Card title="Condiciones del camión" icon={SprayCan}>
          <div className="space-y-3">
            <ConditionRow
              label="Estado del camión"
              icon={Truck}
              catalog="condition-levels-truck"
              value={reception.truck_condition_id ?? null}
              onChange={(id) => set('truck_condition_id', id)}
            />
            <ConditionRow
              label="Estado del hielo"
              icon={Snowflake}
              catalog="condition-levels-ice"
              value={reception.ice_condition_id ?? null}
              onChange={(id) => set('ice_condition_id', id)}
            />
            <ConditionRow
              label="Higiene"
              icon={SprayCan}
              catalog="condition-levels-hygiene"
              value={reception.hygiene_condition_id ?? null}
              onChange={(id) => set('hygiene_condition_id', id)}
            />
          </div>
        </Card>

        {/* ── LOTES (Step2Lotes ya hace esto bien — lo reusamos) ─── */}
        <Card title={`Lotes del camión (${lots.length})`} icon={MapPin}>
          <Step2Lotes lots={lots} onChange={setLots} />
        </Card>

        {/* ── OBSERVACIONES ─────────────────────────────────────── */}
        <Card title="Observaciones" icon={FileCheck}>
          <textarea
            rows={3}
            value={reception.observations ?? ''}
            onChange={(e) => set('observations', e.target.value || null)}
            className={INPUT}
            placeholder="Cualquier nota adicional sobre la recepción…"
          />
        </Card>
      </main>

      {/* Footer flotante con guardar (visible siempre en móvil) */}
      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="text-xs text-slate-500">
            {canSubmit ? '✓ Listo para guardar' : 'Faltan campos obligatorios'}
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submit.isPending}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:bg-slate-300"
          >
            <Save className="h-4 w-4" />
            {submit.isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </footer>
    </div>
  )
}

// =========================================================================
// Mini-componentes
// =========================================================================

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Truck
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-5 py-3.5">
        <div className="rounded-lg bg-cea-100 p-2 ring-1 ring-cea-200">
          <Icon className="h-4 w-4 text-cea-700" strokeWidth={2.5} />
        </div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">{title}</h2>
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Labeled({
  label,
  required,
  icon: Icon,
  children,
}: {
  label: string
  required?: boolean
  icon?: typeof Truck
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

function ConditionRow({
  label,
  icon: Icon,
  catalog,
  value,
  onChange,
}: {
  label: string
  icon: typeof Truck
  catalog: 'condition-levels-truck' | 'condition-levels-ice' | 'condition-levels-hygiene'
  value: number | null
  onChange: (id: number | null) => void
}) {
  const q = useCatalog(catalog)
  const items = (q.data ?? []).filter((i) => (i.extra.condition_code as string) !== 'no_aplica')
  const naItem = (q.data ?? []).find((i) => (i.extra.condition_code as string) === 'no_aplica')

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex w-48 shrink-0 items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {items.map((i) => {
          const selected = value === i.id
          const code = i.extra.condition_code as string
          // Color según semáforo: bueno/suficiente → verde, regular → ámbar, malo → rojo
          const tone =
            ['bueno', 'buena', 'suficiente'].includes(code)
              ? selected
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              : ['regular'].includes(code)
                ? selected
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : selected
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => onChange(selected ? null : i.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${tone}`}
            >
              {i.name}
            </button>
          )
        })}
        {naItem && (
          <button
            type="button"
            onClick={() => onChange(value === naItem.id ? null : naItem.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
              value === naItem.id
                ? 'border-slate-600 bg-slate-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            N/A
          </button>
        )}
      </div>
    </div>
  )
}

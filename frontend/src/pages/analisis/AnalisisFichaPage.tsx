import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import {
  ArrowLeft,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  Save,
  TestTubes,
  Thermometer,
  ListChecks,
  BarChart3,
  Truck,
  Snowflake,
} from 'lucide-react'

import { api } from '../../api/client'
import { useCatalog } from '../../hooks/useCatalogs'
import { useAuth } from '../../contexts/AuthContext'
import CatalogSelect from '../../components/CatalogSelect'
import AttachmentsSection from '../../components/AttachmentsSection'
import type {
  AnalysisRead,
  AnalysisUpsert,
  CatalogItem,
  FlavorIO,
  LotContext,
  OdorIO,
  SamplingDefectIO,
  SamplingIO,
  SampleState,
  SizeDistributionIO,
} from '../../types/domain'

// =========================================================================
// Helpers
// =========================================================================

const today = () => new Date().toISOString().slice(0, 10)
const nowHM = () => new Date().toTimeString().slice(0, 5)

function emptyForm(plantId: number = 1): AnalysisUpsert {
  return {
    plant_id: plantId,
    analysis_date: today(),
    analysis_time: nowHM(),
    status: 'borrador',
    lot_ids: [],
    samplings: [1, 2, 3].map((i) => ({ sampling_index: i as 1 | 2 | 3, defects: [] })),
    colors: [
      { sample_state: 'crudo', color_id: null },
      { sample_state: 'cocido', color_id: null },
    ],
    flavors: [],
    odors: [],
    size_distribution: [],
  }
}

// =========================================================================
// Página
// =========================================================================

export default function AnalisisFichaPage() {
  const params = useParams<{ analysisId?: string; lotId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const [form, setForm] = useState<AnalysisUpsert>(() => emptyForm())
  const [analysisId, setAnalysisId] = useState<number | null>(
    params.analysisId ? Number(params.analysisId) : null,
  )
  const initialized = useRef(false)

  // Carga: por id, o por lote (busca existente, si no, prepara borrador)
  const loadByLot = useQuery({
    queryKey: ['analyses', 'by-lot', params.lotId],
    queryFn: async () =>
      (await api.get<AnalysisRead | null>(`/api/analyses/by-lot/${params.lotId}`)).data,
    enabled: !!params.lotId && !analysisId,
  })

  const loadById = useQuery({
    queryKey: ['analyses', analysisId],
    queryFn: async () =>
      (await api.get<AnalysisRead>(`/api/analyses/${analysisId}`)).data,
    enabled: !!analysisId,
  })

  // Contexto del lote (cabecera + entregas) — siempre que tengamos lotId o lotes cargados
  const contextLotId =
    params.lotId
      ? Number(params.lotId)
      : loadById.data?.lots?.[0]?.lot_id ?? loadByLot.data?.lots?.[0]?.lot_id ?? null

  const lotContextQuery = useQuery({
    queryKey: ['lot-context', contextLotId],
    queryFn: async () =>
      (await api.get<LotContext>(`/api/analyses/lot-context/${contextLotId}`)).data,
    enabled: !!contextLotId,
  })

  // Hidratar el form
  useEffect(() => {
    if (initialized.current) return
    if (loadById.data) {
      setForm(adaptReadToUpsert(loadById.data))
      initialized.current = true
    } else if (loadByLot.data) {
      setAnalysisId(loadByLot.data.analysis_id)
      setForm(adaptReadToUpsert(loadByLot.data))
      initialized.current = true
    } else if (lotContextQuery.data) {
      setForm({
        ...emptyForm(lotContextQuery.data.plant_id ?? 1),
        lot_ids: [lotContextQuery.data.lot_id],
        analyst_id: user?.user_id ?? null,
      })
      initialized.current = true
    }
  }, [loadById.data, loadByLot.data, lotContextQuery.data, user])

  // Guardado: vuelve a la bandeja al terminar
  const save = useMutation({
    mutationFn: async (payload: AnalysisUpsert) => {
      if (analysisId) {
        return (await api.put<AnalysisRead>(`/api/analyses/${analysisId}`, payload)).data
      }
      return (await api.post<AnalysisRead>('/api/analyses', payload)).data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyses', 'pending'] })
      navigate('/analisis')
    },
  })

  const ctx = lotContextQuery.data ?? null
  const [trazaOpen, setTrazaOpen] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

  const update = (patch: Partial<AnalysisUpsert>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Sticky header — toda la cabecera identificativa permanece visible */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 pb-3 pt-4">
          {/* Volver */}
          <button
            onClick={() => navigate('/analisis')}
            className="mb-2 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver
          </button>

          {/* Título: lote + estado + tags */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {ctx ? (
                <>
                  Lote <span className="font-mono">{ctx.lot_code}</span>
                  <span className="ml-1 text-base font-medium text-slate-400">
                    /{ctx.lot_year}
                  </span>
                </>
              ) : (
                'Cargando lote…'
              )}
            </h1>
            <StatusBadge status={form.status} />
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs lowercase text-slate-500">
              {ctx?.product_type ?? ''}
              {ctx?.receptions[0] && (
                <> · recepción {ctx.receptions[0].reception_date}</>
              )}
            </span>
          </div>

          {/* Card con datos identificativos del lote */}
          {ctx && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                <KeyVal
                  label="Origen"
                  value={[ctx.supplier_name, ctx.origin_name].filter(Boolean).join(' — ')}
                />
                <KeyVal label="Producto" value={ctx.product_type} />
                <KeyVal label="PSC" value={ctx.psc} />
                <KeyVal
                  label="Total recibido"
                  value={
                    ctx.total_lbs != null
                      ? `${Number(ctx.total_lbs).toLocaleString('es-EC', {
                          maximumFractionDigits: 0,
                        })} lbs`
                      : null
                  }
                  highlight
                />
              </div>
              {/* Entregas (camiones) — colapsable */}
              {ctx.receptions.length > 0 && (
                <div className="mt-2 border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={() => setTrazaOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition ${trazaOpen ? '' : '-rotate-90'}`}
                    />
                    {ctx.receptions.length === 1
                      ? '1 entrega'
                      : `${ctx.receptions.length} entregas`}
                    <span className="text-slate-400">— Camión, chofer, temperatura</span>
                  </button>
                  {trazaOpen && (
                    <div className="mt-2 space-y-1.5">
                      {ctx.receptions.map((r) => (
                        <div
                          key={r.reception_id}
                          className="grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs sm:grid-cols-6 sm:gap-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cea-700 text-[10px] font-bold text-white">
                              {r.delivery_index}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {r.reception_date}
                            </span>
                            {r.arrival_time && (
                              <span className="text-slate-500">
                                {r.arrival_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3 w-3 text-slate-400" />
                            <span className="font-medium text-slate-700">
                              {r.plate_number ?? '—'}
                            </span>
                          </div>
                          <div className="text-slate-700">{r.driver_name ?? '—'}</div>
                          <div className="text-slate-500">{r.logistics_name ?? '—'}</div>
                          <div className="flex items-center gap-1 text-slate-600">
                            {r.arrival_temperature != null && (
                              <>
                                <Snowflake className="h-3 w-3" />
                                {Number(r.arrival_temperature).toFixed(1)}°C
                              </>
                            )}
                          </div>
                          <div className="text-right font-semibold tabular-nums text-slate-900">
                            {r.received_lbs != null
                              ? `${Number(r.received_lbs).toLocaleString('es-EC', {
                                  maximumFractionDigits: 0,
                                })} lbs`
                              : '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Toolbar destacado: analista + fecha + guardar */}
          <div className="mt-3 rounded-xl border-2 border-cea-200 bg-white p-3 shadow-sm ring-1 ring-cea-900/5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <ToolbarLabel>Analista</ToolbarLabel>
                <input
                  type="text"
                  readOnly
                  value={user?.full_name ?? ''}
                  className="w-full cursor-default rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"
                />
              </div>
              <div className="flex-1">
                <ToolbarLabel>Fecha de análisis</ToolbarLabel>
                <input
                  type="date"
                  value={form.analysis_date}
                  onChange={(e) => update({ analysis_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  // Validación cliente: liberar/rechazar exige decisión
                  if (
                    (form.status === 'validado' || form.status === 'rechazado') &&
                    form.decision_id == null
                  ) {
                    setClientError(
                      'Para liberar o rechazar el análisis debes seleccionar una decisión abajo.',
                    )
                    document.getElementById('decision')?.scrollIntoView({ behavior: 'smooth' })
                    return
                  }
                  setClientError(null)
                  save.mutate(form)
                }}
                disabled={save.isPending || form.lot_ids.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-cea-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cea-800 disabled:bg-slate-300"
              >
                <Save className="h-4 w-4" />
                {save.isPending ? 'Guardando…' : 'Guardar resultados'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mensajes */}
      {(save.isError || clientError) && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {clientError ??
              (save.error as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
              'Error al guardar'}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <SectionCabecera form={form} update={update} />
        <SectionFisicos form={form} update={update} />
        <SectionOrganoleptico title="Crudo" id="crudo" state="crudo" form={form} update={update} />
        <SectionOrganoleptico title="Cocido" id="cocido" state="cocido" form={form} update={update} />
        <SectionMuestreos form={form} update={update} />
        <SectionMiniHistograma form={form} update={update} />
        <SectionDecision form={form} update={update} />

        {ctx && (
          <AttachmentsSection
            lotId={ctx.lot_id}
            analysisId={analysisId ?? undefined}
            defaultTypeCode="foto_muestra"
          />
        )}
      </main>
    </div>
  )
}

// =========================================================================
// Adaptación lectura → upsert
// =========================================================================

function adaptReadToUpsert(r: AnalysisRead): AnalysisUpsert {
  return {
    plant_id: r.plant_id,
    analysis_date: r.analysis_date,
    analysis_time: r.analysis_time,
    shift: r.shift,
    analyst_id: r.analyst_id,
    sample_total_weight: r.sample_total_weight,
    total_units: r.total_units,
    global_grammage: r.global_grammage,
    so2_residual_ppm: r.so2_residual_ppm,
    so2_global: r.so2_global,
    average_grammage: r.average_grammage,
    average_classification_code: r.average_classification_code,
    product_temperature: r.product_temperature,
    gr_cc: r.gr_cc,
    c_kg: r.c_kg,
    gr_sc: r.gr_sc,
    c_kg2: r.c_kg2,
    decision_id: r.decision_id,
    destined_product_type: r.destined_product_type,
    global_defect_percentage: r.global_defect_percentage,
    good_product_percentage: r.good_product_percentage,
    general_observations: r.general_observations,
    status: r.status,
    lot_ids: r.lots.map((l) => l.lot_id),
    samplings:
      r.samplings.length > 0
        ? r.samplings.map((s) => ({
            sampling_index: s.sampling_index as 1 | 2 | 3,
            units_count: s.units_count,
            defect_units: s.defect_units,
            good_units: s.good_units,
            defect_percentage: s.defect_percentage,
            good_percentage: s.good_percentage,
            defects: s.defects.map(({ defect_id, units_count, percentage }) => ({
              defect_id,
              units_count,
              percentage,
            })),
          }))
        : [1, 2, 3].map((i) => ({ sampling_index: i as 1 | 2 | 3, defects: [] })),
    colors:
      r.colors.length > 0
        ? r.colors.map(({ sample_state, color_id }) => ({
            sample_state: sample_state as SampleState,
            color_id,
          }))
        : [
            { sample_state: 'crudo', color_id: null },
            { sample_state: 'cocido', color_id: null },
          ],
    flavors: r.flavors.map(({ sample_state, flavor_id, intensity_id, percentage }) => ({
      sample_state: sample_state as SampleState,
      flavor_id,
      intensity_id,
      percentage,
    })),
    odors: r.odors.map(({ sample_state, odor_id, intensity_id, presence, observations }) => ({
      sample_state: sample_state as SampleState,
      odor_id,
      intensity_id,
      presence,
      observations,
    })),
    size_distribution: r.size_distribution.map(
      ({ cc_classification_id, weight_grams, units_count, average_grammage }) => ({
        cc_classification_id: cc_classification_id ?? 0,
        weight_grams,
        units_count,
        average_grammage,
      }),
    ),
  }
}

// =========================================================================
// Pequeños componentes UI
// =========================================================================

function KeyVal({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | null | undefined
  highlight?: boolean
}) {
  return (
    <div className="leading-tight">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-sm ${
          highlight ? 'font-bold text-cea-700' : 'font-semibold text-slate-900'
        }`}
        title={value ?? ''}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function ToolbarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
      {children}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    borrador: 'bg-slate-100 text-slate-700 ring-slate-200',
    en_revision: 'bg-amber-100 text-amber-800 ring-amber-200',
    validado: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    rechazado: 'bg-red-100 text-red-800 ring-red-300',
  }
  const label: Record<string, string> = {
    borrador: 'borrador',
    en_revision: 'en revisión',
    validado: 'liberada',
    rechazado: 'rechazada',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        map[status] ?? map.borrador
      }`}
    >
      {label[status] ?? status}
    </span>
  )
}

function Section({
  id,
  title,
  icon: Icon,
  children,
  description,
}: {
  id: string
  title: string
  icon: typeof ClipboardCheck
  children: React.ReactNode
  description?: string
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5"
    >
      <header className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-cea-100 p-2 ring-1 ring-cea-200">
            <Icon className="h-4 w-4 text-cea-700" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs font-normal text-slate-500">{description}</p>
            )}
          </div>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </section>
  )
}

// Input principal (formulario): borde claro pero presente, fondo blanco, foco visible.
const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30'

// Input compacto para celdas de tabla: relleno gris suave para que se vea siempre.
const CELL_INPUT =
  'w-full rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-right text-sm font-semibold tabular-nums text-slate-900 shadow-sm outline-none transition hover:border-slate-400 focus:border-cea-500 focus:bg-white focus:ring-2 focus:ring-cea-500/30'

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

function NumInput({
  value,
  onChange,
  step = '0.01',
  placeholder,
}: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  step?: string
  placeholder?: string
}) {
  return (
    <input
      type="number"
      step={step}
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={INPUT}
    />
  )
}

// =========================================================================
// Secciones
// =========================================================================

function SectionCabecera({
  form,
  update,
}: {
  form: AnalysisUpsert
  update: (p: Partial<AnalysisUpsert>) => void
}) {
  return (
    <Section id="general" title="Datos generales" icon={ClipboardCheck}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Planta">
          <CatalogSelect
            catalog="plants"
            value={form.plant_id || null}
            onChange={(id) => update({ plant_id: id ?? 0 })}
          />
        </Field>
        <Field label="Hora del análisis">
          <input
            type="time"
            value={form.analysis_time ?? ''}
            onChange={(e) => update({ analysis_time: e.target.value || null })}
            className={INPUT}
          />
        </Field>
        <Field label="Turno">
          <div className="flex gap-2">
            {(['T/D', 'T/N'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ shift: t })}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
                  form.shift === t
                    ? 'border-cea-700 bg-cea-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Section>
  )
}

function ClasificacionPromedioSelect({
  value,
  onChange,
}: {
  value: string | null | undefined
  onChange: (v: string | null) => void
}) {
  const cc = useCatalog('cc-classifications')
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={INPUT}
    >
      <option value="">—</option>
      {(cc.data ?? []).map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
        </option>
      ))}
    </select>
  )
}

function SectionFisicos({
  form,
  update,
}: {
  form: AnalysisUpsert
  update: (p: Partial<AnalysisUpsert>) => void
}) {
  type Row =
    | {
        kind: 'num'
        param: string
        unit?: string
        ref?: string
        get: () => number | null | undefined
        set: (v: number | null) => void
        step?: string
      }
    | {
        kind: 'select'
        param: string
        ref?: string
        node: React.ReactNode
      }

  const rows: Row[] = [
    {
      kind: 'num', param: 'Peso muestra', unit: 'g',
      ref: 'R-CC-001 cabecera',
      get: () => form.sample_total_weight,
      set: (v) => update({ sample_total_weight: v }),
    },
    {
      kind: 'num', param: 'Total unidades',
      get: () => form.total_units,
      set: (v) => update({ total_units: v }), step: '1',
    },
    {
      kind: 'num', param: 'Gramaje global', unit: 'g',
      get: () => form.global_grammage,
      set: (v) => update({ global_grammage: v }),
    },
    {
      kind: 'num', param: 'Gramaje promedio', unit: 'g',
      get: () => form.average_grammage,
      set: (v) => update({ average_grammage: v }),
    },
    {
      kind: 'select', param: 'Clasificación promedio',
      ref: 'R-CC-034',
      node: (
        <ClasificacionPromedioSelect
          value={form.average_classification_code}
          onChange={(code) => update({ average_classification_code: code })}
        />
      ),
    },
    {
      kind: 'num', param: 'SO₂ residual', unit: 'ppm',
      ref: 'metabisulfito',
      get: () => form.so2_residual_ppm,
      set: (v) => update({ so2_residual_ppm: v }),
    },
    {
      kind: 'num', param: 'SO₂ global',
      get: () => form.so2_global,
      set: (v) => update({ so2_global: v }),
    },
    {
      kind: 'num', param: 'Temperatura producto', unit: '°C',
      get: () => form.product_temperature,
      set: (v) => update({ product_temperature: v }),
    },
    {
      kind: 'num', param: 'gr CC',
      ref: 'cálculo Excel',
      get: () => form.gr_cc, set: (v) => update({ gr_cc: v }),
    },
    {
      kind: 'num', param: 'C/kg',
      get: () => form.c_kg, set: (v) => update({ c_kg: v }),
    },
    {
      kind: 'num', param: 'gr SC',
      get: () => form.gr_sc, set: (v) => update({ gr_sc: v }),
    },
    {
      kind: 'num', param: 'C/kg (2)',
      get: () => form.c_kg2, set: (v) => update({ c_kg2: v }),
    },
  ]

  return (
    <Section id="fisicos" title="Datos físicos" icon={Thermometer}>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
              <th className="w-2/3 py-3 pl-4 pr-2 font-semibold">Parámetro</th>
              <th className="px-3 py-3 font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.param}
                className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-cea-50/30`}
              >
                <td className="py-2.5 pl-4 pr-2">
                  <div className="font-semibold text-slate-800">
                    {r.param}
                    {r.kind === 'num' && r.unit && (
                      <span className="ml-1 font-normal text-slate-500">({r.unit})</span>
                    )}
                  </div>
                  {r.ref && <div className="text-xs text-slate-400">{r.ref}</div>}
                </td>
                <td className="px-3 py-2 align-middle">
                  {r.kind === 'num' ? (
                    <input
                      type="number"
                      step={r.step ?? '0.01'}
                      value={r.get() ?? ''}
                      onChange={(e) =>
                        r.set(e.target.value === '' ? null : Number(e.target.value))
                      }
                      className={CELL_INPUT}
                    />
                  ) : (
                    r.node
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ── Organoléptico ────────────────────────────────────────────────────

function SectionOrganoleptico({
  title,
  id,
  state,
  form,
  update,
}: {
  title: string
  id: string
  state: SampleState
  form: AnalysisUpsert
  update: (p: Partial<AnalysisUpsert>) => void
}) {
  const flavors = useCatalog('flavors')
  const odors = useCatalog('odors')
  const intensities = useCatalog('intensities')

  const colorEntry = form.colors.find((c) => c.sample_state === state)
  const setColor = (color_id: number | null) => {
    const others = form.colors.filter((c) => c.sample_state !== state)
    update({ colors: [...others, { sample_state: state, color_id }] })
  }

  const stateFlavors = form.flavors.filter((f) => f.sample_state === state)
  const stateOdors = form.odors.filter((o) => o.sample_state === state)

  const setFlavors = (next: FlavorIO[]) => {
    const others = form.flavors.filter((f) => f.sample_state !== state)
    update({ flavors: [...others, ...next] })
  }
  const setOdors = (next: OdorIO[]) => {
    const others = form.odors.filter((o) => o.sample_state !== state)
    update({ odors: [...others, ...next] })
  }

  return (
    <Section id={id} title={`Organoléptico — ${title}`} icon={state === 'crudo' ? TestTubes : ChefHat}>
      <div className="space-y-5">
        {/* Color */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Color">
            <CatalogSelect
              catalog="colors"
              value={colorEntry?.color_id ?? null}
              onChange={setColor}
            />
          </Field>
        </div>

        {/* Sabores */}
        <ChipsMultiSelect
          label="Sabores"
          options={flavors.data ?? []}
          intensities={intensities.data ?? []}
          selected={stateFlavors.map((f) => ({
            optionId: f.flavor_id,
            intensityId: f.intensity_id ?? null,
            percentage: f.percentage ?? null,
          }))}
          onChange={(next) =>
            setFlavors(
              next.map((e) => ({
                sample_state: state,
                flavor_id: e.optionId,
                intensity_id: e.intensityId,
                percentage: e.percentage,
              })),
            )
          }
          showPercentage
        />

        {/* Olores */}
        <ChipsMultiSelect
          label="Olores"
          options={odors.data ?? []}
          intensities={intensities.data ?? []}
          selected={stateOdors.map((o) => ({
            optionId: o.odor_id,
            intensityId: o.intensity_id ?? null,
            percentage: null,
          }))}
          onChange={(next) =>
            setOdors(
              next.map((e) => ({
                sample_state: state,
                odor_id: e.optionId,
                intensity_id: e.intensityId,
                presence: true,
              })),
            )
          }
          showPercentage={false}
        />
      </div>
    </Section>
  )
}

interface IntensityEntry {
  optionId: number
  intensityId: number | null
  percentage: number | null
}

/**
 * Selector unificado de chips + intensidad (+ % opcional).
 * Se usa idéntico para sabores y olores.
 */
function ChipsMultiSelect({
  label,
  options,
  intensities,
  selected,
  onChange,
  showPercentage = true,
}: {
  label: string
  options: CatalogItem[]
  intensities: CatalogItem[]
  selected: IntensityEntry[]
  onChange: (next: IntensityEntry[]) => void
  showPercentage?: boolean
}) {
  const toggle = (optionId: number) => {
    const exists = selected.find((e) => e.optionId === optionId)
    if (exists) {
      onChange(selected.filter((e) => e.optionId !== optionId))
    } else {
      onChange([...selected, { optionId, intensityId: null, percentage: null }])
    }
  }

  const updateEntry = (optionId: number, patch: Partial<IntensityEntry>) =>
    onChange(selected.map((c) => (c.optionId === optionId ? { ...c, ...patch } : c)))

  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </div>

      {/* Fila de chips para selección rápida */}
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const isSelected = !!selected.find((e) => e.optionId === o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                isSelected
                  ? 'border-cea-700 bg-cea-700 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {o.name}
            </button>
          )
        })}
      </div>

      {/* Detalle de los seleccionados (intensidad + opcional %) */}
      {selected.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
                <th className="py-2 pl-4 pr-2 font-semibold">{label.slice(0, -1)}</th>
                <th className="px-3 py-2 font-semibold">Intensidad</th>
                {showPercentage && (
                  <th className="px-3 py-2 text-right font-semibold">%</th>
                )}
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {selected.map((e, idx) => {
                const opt = options.find((o) => o.id === e.optionId)
                return (
                  <tr
                    key={e.optionId}
                    className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}
                  >
                    <td className="py-2 pl-4 pr-2 font-semibold text-slate-800">
                      {opt?.name ?? `#${e.optionId}`}
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        value={e.intensityId ?? ''}
                        onChange={(ev) =>
                          updateEntry(e.optionId, {
                            intensityId: ev.target.value ? Number(ev.target.value) : null,
                          })
                        }
                        className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-cea-500 focus:bg-white focus:ring-2 focus:ring-cea-500/30"
                      >
                        <option value="">—</option>
                        {intensities.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    {showPercentage && (
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="100"
                          placeholder="—"
                          value={e.percentage ?? ''}
                          onChange={(ev) =>
                            updateEntry(e.optionId, {
                              percentage:
                                ev.target.value === '' ? null : Number(ev.target.value),
                            })
                          }
                          className="w-20 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-right text-sm font-semibold tabular-nums text-slate-900 outline-none focus:border-cea-500 focus:bg-white focus:ring-2 focus:ring-cea-500/30"
                        />
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggle(e.optionId)}
                        title="Quitar"
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Muestreos ────────────────────────────────────────────────────────

function SectionMuestreos({
  form,
  update,
}: {
  form: AnalysisUpsert
  update: (p: Partial<AnalysisUpsert>) => void
}) {
  const defects = useCatalog('defects')

  // Defectos preimpresos en el R-CC-001 vs los que se añaden a mano
  const paperDefects = useMemo(
    () =>
      (defects.data ?? [])
        .filter((d) => (d.extra.in_paper_form as boolean) ?? false)
        .sort(
          (a, b) =>
            ((a.extra.sort_order as number) ?? 0) - ((b.extra.sort_order as number) ?? 0),
        ),
    [defects.data],
  )
  const otherDefects = useMemo(
    () => (defects.data ?? []).filter((d) => !(d.extra.in_paper_form as boolean)),
    [defects.data],
  )

  const updateSampling = (idx: number, patch: Partial<SamplingIO>) => {
    update({
      samplings: form.samplings.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    })
  }

  const setDefectCount = (idx: number, defect_id: number, count: number | null) => {
    const sampling = form.samplings[idx]
    const without = sampling.defects.filter((d) => d.defect_id !== defect_id)
    const next: SamplingDefectIO[] =
      count == null || count === 0
        ? without
        : [...without, { defect_id, units_count: count }]
    updateSampling(idx, { defects: next })
  }

  return (
    <Section
      id="muestreos"
      title="Muestreos (1, 2, 3)"
      icon={ListChecks}
      description="Defectos por muestreo según R-CC-001"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="muestreos-table w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700">
              <th className="py-3 pl-4 pr-2 font-bold">Defecto</th>
              <th className="w-28 px-3 py-3 text-center font-bold">1er</th>
              <th className="w-28 px-3 py-3 text-center font-bold">2do</th>
              <th className="w-28 px-3 py-3 text-center font-bold">3ro</th>
            </tr>
          </thead>
          <tbody>
            {/* Cabecera de cada muestreo: piezas totales (destacada) */}
            <tr className="border-b-2 border-cea-200 bg-cea-50">
              <td className="py-3 pl-4 pr-2 text-xs font-bold uppercase tracking-wide text-cea-800">
                Piezas totales
              </td>
              {form.samplings.map((s, i) => (
                <td key={i} className="px-3 py-2.5 text-right">
                  <input
                    type="number"
                    step="1"
                    value={s.units_count ?? ''}
                    onChange={(e) =>
                      updateSampling(i, {
                        units_count: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className={CELL_INPUT}
                  />
                </td>
              ))}
            </tr>

            {paperDefects.map((d, idx) => (
              <DefectRow
                key={d.id}
                name={d.name}
                samplings={form.samplings}
                defectId={d.id}
                onSet={setDefectCount}
                zebra={idx % 2 === 1}
              />
            ))}

            {/* Defectos extras (Excel/observaciones) — render solo si tiene entrada */}
            {otherDefects
              .filter((d) =>
                form.samplings.some((s) => s.defects.find((x) => x.defect_id === d.id)),
              )
              .map((d) => (
                <DefectRow
                  key={d.id}
                  name={d.name}
                  isExtra
                  samplings={form.samplings}
                  defectId={d.id}
                  onSet={setDefectCount}
                />
              ))}
          </tbody>
        </table>
      </div>

      {/* Añadir defecto extra (no preimpreso en el R-CC-001) */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Añadir defecto extra:</span>
        <select
          value=""
          onChange={(e) => {
            const id = Number(e.target.value)
            if (!id) return
            // Activa la fila del defecto poniéndolo (con 0 piezas) en el 1er muestreo
            update({
              samplings: form.samplings.map((s, i) =>
                i === 0 && !s.defects.find((x) => x.defect_id === id)
                  ? { ...s, defects: [...s.defects, { defect_id: id, units_count: null }] }
                  : s,
              ),
            })
          }}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">Seleccionar…</option>
          {otherDefects
            .filter((d) => !form.samplings.some((s) => s.defects.find((x) => x.defect_id === d.id)))
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
      </div>
    </Section>
  )
}

function DefectRow({
  name,
  defectId,
  samplings,
  onSet,
  zebra = false,
  isExtra = false,
}: {
  name: string
  defectId: number
  samplings: SamplingIO[]
  onSet: (samplingIdx: number, defectId: number, count: number | null) => void
  zebra?: boolean
  isExtra?: boolean
}) {
  // focus-within ilumina toda la fila cuando cualquier input recibe foco.
  const baseBg = isExtra ? 'bg-amber-50/40' : zebra ? 'bg-slate-50' : 'bg-white'
  const hoverBg = isExtra ? 'hover:bg-amber-50/70' : 'hover:bg-cea-50/40'
  return (
    <tr
      className={`border-b border-slate-200 ${baseBg} ${hoverBg} focus-within:!bg-cea-100 focus-within:shadow-[inset_3px_0_0_0_theme(colors.cea.700)]`}
    >
      <td className="py-2.5 pl-4 pr-2 align-middle font-semibold text-slate-800">
        <span className="inline-flex items-center gap-2">
          {name}
          {isExtra && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              extra
            </span>
          )}
        </span>
      </td>
      {samplings.map((s, i) => {
        const entry = s.defects.find((x) => x.defect_id === defectId)
        return (
          <td
            key={i}
            className="border-l border-dashed border-slate-200 px-3 py-2 text-right align-middle"
          >
            <input
              type="number"
              step="1"
              min="0"
              value={entry?.units_count ?? ''}
              onChange={(e) =>
                onSet(i, defectId, e.target.value === '' ? null : Number(e.target.value))
              }
              className={CELL_INPUT}
            />
          </td>
        )
      })}
    </tr>
  )
}

// ── Mini-histograma CC ───────────────────────────────────────────────

function SectionMiniHistograma({
  form,
  update,
}: {
  form: AnalysisUpsert
  update: (p: Partial<AnalysisUpsert>) => void
}) {
  const cc = useCatalog('cc-classifications')

  const setEntry = (cc_id: number, patch: Partial<SizeDistributionIO>) => {
    const existing = form.size_distribution.find((s) => s.cc_classification_id === cc_id)
    if (!existing && patch.weight_grams == null && patch.units_count == null) return
    const updated: SizeDistributionIO = {
      cc_classification_id: cc_id,
      weight_grams: patch.weight_grams ?? existing?.weight_grams ?? null,
      units_count: patch.units_count ?? existing?.units_count ?? null,
      average_grammage: patch.average_grammage ?? existing?.average_grammage ?? null,
    }
    update({
      size_distribution: [
        ...form.size_distribution.filter((s) => s.cc_classification_id !== cc_id),
        updated,
      ],
    })
  }

  // Ordenar por sort_order numérico (no alfabético) para que 20-30 vaya antes que 100/120
  const ranges = useMemo(
    () =>
      [...(cc.data ?? [])].sort(
        (a, b) =>
          ((a.extra.sort_order as number) ?? 0) - ((b.extra.sort_order as number) ?? 0),
      ),
    [cc.data],
  )

  return (
    <Section
      id="histo"
      title="Distribución por clasificación CC"
      icon={BarChart3}
      description="Mini-histograma del R-CC-001 (la curva grande va al R-CC-034)"
    >
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700">
              <th className="py-3 pl-4 pr-2 font-bold">Rango CC</th>
              <th className="w-32 px-3 py-3 text-center font-bold">Peso (g)</th>
              <th className="w-28 px-3 py-3 text-center font-bold">Piezas</th>
              <th className="w-32 px-3 py-3 text-center font-bold">Gramaje promedio</th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((c, idx) => {
              const e = form.size_distribution.find((s) => s.cc_classification_id === c.id)
              return (
                <tr
                  key={c.id}
                  className={`border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-cea-50/40 focus-within:!bg-cea-100 focus-within:shadow-[inset_3px_0_0_0_theme(colors.cea.700)]`}
                >
                  <td className="py-2.5 pl-4 pr-2 align-middle font-semibold text-slate-800">
                    {c.name}
                  </td>
                  <td className="border-l border-dashed border-slate-200 px-3 py-2 text-right align-middle">
                    <input
                      type="number"
                      step="0.01"
                      value={e?.weight_grams ?? ''}
                      onChange={(ev) =>
                        setEntry(c.id, {
                          weight_grams: ev.target.value === '' ? null : Number(ev.target.value),
                        })
                      }
                      className={CELL_INPUT}
                    />
                  </td>
                  <td className="border-l border-dashed border-slate-200 px-3 py-2 text-right align-middle">
                    <input
                      type="number"
                      step="1"
                      value={e?.units_count ?? ''}
                      onChange={(ev) =>
                        setEntry(c.id, {
                          units_count: ev.target.value === '' ? null : Number(ev.target.value),
                        })
                      }
                      className={CELL_INPUT}
                    />
                  </td>
                  <td className="border-l border-dashed border-slate-200 px-3 py-2 text-right align-middle">
                    <input
                      type="number"
                      step="0.01"
                      value={e?.average_grammage ?? ''}
                      onChange={(ev) =>
                        setEntry(c.id, {
                          average_grammage: ev.target.value === '' ? null : Number(ev.target.value),
                        })
                      }
                      className={CELL_INPUT}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

// ── Decisión + observaciones ─────────────────────────────────────────

function SectionDecision({
  form,
  update,
}: {
  form: AnalysisUpsert
  update: (p: Partial<AnalysisUpsert>) => void
}) {
  const decisions = useCatalog('decisions')

  return (
    <Section
      id="decision"
      title="Decisión y observaciones"
      icon={ClipboardCheck}
      description="Un análisis no puede validarse sin decisión"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Field label="Decisión">
          <div className="flex flex-wrap gap-1.5">
            {(decisions.data ?? [])
              .sort(
                (a, b) =>
                  ((a.extra.sort_order as number) ?? 0) -
                  ((b.extra.sort_order as number) ?? 0),
              )
              .map((d) => {
                const isApproval = d.extra.is_approval as boolean
                const isRejection = d.extra.is_rejection as boolean
                const selected = form.decision_id === d.id
                const baseClass = isRejection
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : isApproval
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-amber-300 bg-amber-50 text-amber-700'
                const selectedClass = isRejection
                  ? 'border-red-600 bg-red-600 text-white'
                  : isApproval
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-amber-600 bg-amber-600 text-white'
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => update({ decision_id: selected ? null : d.id })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      selected ? selectedClass : baseClass
                    }`}
                  >
                    {d.name}
                  </button>
                )
              })}
          </div>
        </Field>

        <Field label="Producto destinado a">
          <div className="flex gap-2">
            {(['ENTERO', 'COLA'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() =>
                  update({
                    destined_product_type: form.destined_product_type === p ? null : p,
                  })
                }
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                  form.destined_product_type === p
                    ? 'border-cea-700 bg-cea-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Estado del análisis">
          <select
            value={form.status}
            onChange={(e) => update({ status: e.target.value as AnalysisUpsert['status'] })}
            className={INPUT}
          >
            <option value="borrador">Borrador</option>
            <option value="en_revision">En revisión</option>
            <option value="validado">Validado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </Field>

        <Field label="% defectos global">
          <NumInput
            value={form.global_defect_percentage}
            onChange={(v) => update({ global_defect_percentage: v })}
          />
        </Field>
        <Field label="% camarón bueno">
          <NumInput
            value={form.good_product_percentage}
            onChange={(v) => update({ good_product_percentage: v })}
          />
        </Field>

        <div className="lg:col-span-3">
          <Field label="Observaciones generales">
            <textarea
              rows={3}
              value={form.general_observations ?? ''}
              onChange={(e) => update({ general_observations: e.target.value || null })}
              className={INPUT}
            />
          </Field>
        </div>
      </div>
    </Section>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import {
  ArrowLeft,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  Image as ImageIcon,
  Pencil,
  Save,
  TestTubes,
  Thermometer,
  ListChecks,
  BarChart3,
  Truck,
  Snowflake,
  X as XIcon,
} from 'lucide-react'

import { api } from '../../api/client'
import { useCatalog } from '../../hooks/useCatalogs'
import { useAuth } from '../../contexts/AuthContext'
import CatalogSelect from '../../components/CatalogSelect'
import AttachmentsModal from '../../components/AttachmentsModal'
import RecepcionDetalleModal from '../../components/RecepcionDetalleModal'
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
      setIsEditing(false)
    } else if (loadByLot.data) {
      setAnalysisId(loadByLot.data.analysis_id)
      setForm(adaptReadToUpsert(loadByLot.data))
      initialized.current = true
      setIsEditing(false)
    } else if (lotContextQuery.data) {
      setForm({
        ...emptyForm(lotContextQuery.data.plant_id ?? 1),
        lot_ids: [lotContextQuery.data.lot_id],
        analyst_id: user?.user_id ?? null,
      })
      initialized.current = true
      setIsEditing(true) // nuevo → arranca editable
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

  const startEdit = () => {
    setSnapshot({ ...form })
    setIsEditing(true)
    setClientError(null)
  }
  const cancelEdit = () => {
    if (snapshot) setForm(snapshot)
    setSnapshot(null)
    setIsEditing(false)
    setClientError(null)
  }
  const handleSave = () => {
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
  }

  const ctx = lotContextQuery.data ?? null
  const [trazaOpen, setTrazaOpen] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  // Modo edición. Existentes arrancan en lectura, nuevos en edición.
  const [isEditing, setIsEditing] = useState(false)
  const [snapshot, setSnapshot] = useState<AnalysisUpsert | null>(null)
  const [recepcionModalOpen, setRecepcionModalOpen] = useState(false)
  const [fotosModalOpen, setFotosModalOpen] = useState(false)

  const update = (patch: Partial<AnalysisUpsert>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Sticky header compacto — solo lo esencial siempre visible */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 pb-2 pt-2">
          {/* Línea 1: volver + título + estado + acciones (todo en una fila) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              onClick={() => navigate('/analisis')}
              className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Volver
            </button>
            <span className="text-slate-300">|</span>

            <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
              {ctx ? (
                <>
                  Lote <span className="font-mono">{ctx.lot_code}</span>
                  <span className="ml-1 text-sm font-medium text-slate-400">
                    /{ctx.lot_year}
                  </span>
                </>
              ) : (
                'Cargando…'
              )}
            </h1>
            <StatusBadge status={form.status} />
            {ctx?.product_type && (
              <span className="text-xs text-slate-500">
                Tipo de producto: <span className="font-semibold text-slate-700">{ctx.product_type}</span>
              </span>
            )}

            {/* Spacer para empujar las acciones a la derecha */}
            <div className="flex-1" />

            {/* Toolbar inline: analista (compacto) + fecha + guardar */}
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-500 sm:inline">
                {user?.full_name?.split(' ')[0]}
              </span>
              <input
                type="date"
                value={form.analysis_date}
                onChange={(e) => update({ analysis_date: e.target.value })}
                disabled={!isEditing}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
              {!isEditing ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={save.isPending}
                    className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={save.isPending || form.lot_ids.length === 0}
                    className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {save.isPending ? 'Guardando…' : 'Guardar'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Línea 2: tira con datos clave del lote (single line, scrollable) */}
          {ctx && (
            <div className="mt-1.5 flex items-center gap-1 border-t border-slate-100 pt-1.5">
              <button
                type="button"
                onClick={() => setTrazaOpen((v) => !v)}
                className="shrink-0 rounded-md p-0.5 hover:bg-slate-100"
                title={trazaOpen ? 'Ocultar entregas' : 'Ver entregas'}
              >
                <ChevronDown
                  className={`h-4 w-4 text-cea-700 transition ${trazaOpen ? '' : '-rotate-90'}`}
                />
              </button>
              <div className="flex flex-1 items-center gap-x-3 gap-y-1 overflow-x-auto whitespace-nowrap text-xs">
                <Pill label="Origen" value={ctx.supplier_name} />
                {ctx.origin_name && (
                  <>
                    <Sep />
                    <Pill label="Procedencia" value={ctx.origin_name} />
                  </>
                )}
                {ctx.psc && (
                  <>
                    <Sep />
                    <Pill label="PSC" value={ctx.psc} />
                  </>
                )}
                <Sep />
                <span className="font-bold tabular-nums text-cea-700">
                  {ctx.total_lbs != null
                    ? `${Number(ctx.total_lbs).toLocaleString('es-EC', {
                        maximumFractionDigits: 0,
                      })} lbs`
                    : '— lbs'}
                </span>
                <Sep />
                <span className="font-medium text-slate-600">
                  {ctx.receptions.length === 1
                    ? '1 entrega'
                    : `${ctx.receptions.length} entregas`}
                </span>
              </div>
            </div>
          )}

          {/* Detalle expandido de entregas */}
          {ctx && trazaOpen && ctx.receptions.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
              {ctx.receptions.map((r) => (
                <div
                  key={r.reception_id}
                  className="grid grid-cols-2 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs sm:grid-cols-6 sm:gap-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cea-700 text-[10px] font-bold text-white">
                      {r.delivery_index}
                    </span>
                    <span className="font-semibold text-slate-900">{r.reception_date}</span>
                    {r.arrival_time && (
                      <span className="text-slate-500">{r.arrival_time.slice(0, 5)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Truck className="h-3 w-3 text-slate-400" />
                    <span className="font-medium text-slate-700">{r.plate_number ?? '—'}</span>
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

      {recepcionModalOpen && ctx && (
        <RecepcionDetalleModal ctx={ctx} onClose={() => setRecepcionModalOpen(false)} />
      )}

      <main className="mx-auto max-w-6xl space-y-3 px-4 py-3">
        {/* Toolbar de acciones — fuera del fieldset para que siga funcionando
            aunque el formulario esté en modo lectura. */}
        {ctx && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {ctx.product_type && (
              <span className="mr-auto inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-orange-800 shadow-sm">
                <span className="text-[10px] font-medium normal-case text-orange-600">
                  Producto:
                </span>
                {ctx.product_type}
              </span>
            )}
            <ActionButton
              icon={Truck}
              label="Datos recepción"
              onClick={() => setRecepcionModalOpen(true)}
              variant="cea"
            />
            <ActionButton
              icon={ImageIcon}
              label="Fotos y archivos"
              onClick={() => setFotosModalOpen(true)}
              variant="violet"
            />
          </div>
        )}

        <fieldset
          disabled={!isEditing}
          className="space-y-3 transition disabled:cursor-default disabled:opacity-95"
        >
        <SectionCabecera form={form} update={update} />
        <SectionFisicos form={form} update={update} />
        <div className="grid gap-3 md:grid-cols-2">
          <SectionOrganoleptico title="Crudo" id="crudo" state="crudo" form={form} update={update} />
          <SectionOrganoleptico title="Cocido" id="cocido" state="cocido" form={form} update={update} />
        </div>
        <SectionMuestreos form={form} update={update} />
        <SectionMiniHistograma form={form} update={update} />
        <SectionDecision form={form} update={update} />
        </fieldset>
      </main>

      {fotosModalOpen && ctx && (
        <AttachmentsModal
          lotId={ctx.lot_id}
          analysisId={analysisId ?? undefined}
          onClose={() => setFotosModalOpen(false)}
        />
      )}
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
    samplings: (() => {
      // Siempre 3 muestreos en el formulario (aunque en BD hubiera menos)
      const result: SamplingIO[] = [1, 2, 3].map((i) => ({
        sampling_index: i as 1 | 2 | 3,
        defects: [],
      }))
      for (const s of r.samplings) {
        const idx = s.sampling_index - 1
        if (idx >= 0 && idx < 3) {
          result[idx] = {
            sampling_index: s.sampling_index as 1 | 2 | 3,
            units_count: s.units_count,
            defect_units: s.defect_units,
            good_units: s.good_units,
            defect_percentage: s.defect_percentage,
            good_percentage: s.good_percentage,
            so2_ppm: (s as { so2_ppm?: number | null }).so2_ppm ?? null,
            defects: s.defects.map(({ defect_id, units_count, percentage }) => ({
              defect_id,
              units_count,
              percentage,
            })),
          }
        }
      }
      return result
    })(),
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

type ActionVariant = 'cea' | 'emerald' | 'amber' | 'violet'

/** Botón de acción profesional con un toque de color brand. */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'cea',
}: {
  icon: typeof Truck
  label: string
  onClick: () => void
  variant?: ActionVariant
}) {
  const palettes: Record<ActionVariant, { btn: string; iconBox: string }> = {
    cea: {
      btn:
        'border-cea-200 bg-gradient-to-b from-cea-50 to-white text-cea-800 ' +
        'hover:border-cea-400 hover:from-cea-100 hover:to-cea-50 hover:text-cea-900',
      iconBox:
        'bg-cea-100 text-cea-700 ring-1 ring-cea-200 group-hover:bg-cea-600 group-hover:text-white group-hover:ring-cea-700',
    },
    emerald: {
      btn:
        'border-emerald-200 bg-gradient-to-b from-emerald-50 to-white text-emerald-800 ' +
        'hover:border-emerald-400 hover:from-emerald-100 hover:to-emerald-50 hover:text-emerald-900',
      iconBox:
        'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:ring-emerald-700',
    },
    amber: {
      btn:
        'border-amber-200 bg-gradient-to-b from-amber-50 to-white text-amber-800 ' +
        'hover:border-amber-400 hover:from-amber-100 hover:to-amber-50 hover:text-amber-900',
      iconBox:
        'bg-amber-100 text-amber-700 ring-1 ring-amber-200 group-hover:bg-amber-600 group-hover:text-white group-hover:ring-amber-700',
    },
    violet: {
      btn:
        'border-violet-200 bg-gradient-to-b from-violet-50 to-white text-violet-800 ' +
        'hover:border-violet-400 hover:from-violet-100 hover:to-violet-50 hover:text-violet-900',
      iconBox:
        'bg-violet-100 text-violet-700 ring-1 ring-violet-200 group-hover:bg-violet-600 group-hover:text-white group-hover:ring-violet-700',
    },
  }
  const p = palettes[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold uppercase tracking-wider shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-px hover:shadow-md active:translate-y-0 active:shadow-sm ${p.btn}`}
    >
      <span className={`flex h-5 w-5 items-center justify-center rounded-md transition ${p.iconBox}`}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function Pill({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className="font-medium text-slate-800">{value}</span>
    </span>
  )
}

function Sep() {
  return <span className="text-slate-300">·</span>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    borrador: 'bg-slate-100 text-slate-700 ring-slate-200',
    en_revision: 'bg-amber-100 text-amber-800 ring-amber-200',
    validado: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    rechazado: 'bg-red-100 text-red-800 ring-red-300',
  }
  const label: Record<string, string> = {
    borrador: 'en análisis',
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
  action,
}: {
  id: string
  title: string
  icon: typeof ClipboardCheck
  children: React.ReactNode
  description?: string
  action?: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-32 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-cea-100 p-1.5 ring-1 ring-cea-200">
            <Icon className="h-3.5 w-3.5 text-cea-700" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h2>
            {description && (
              <p className="text-[10px] font-normal text-slate-500">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  )
}

// Input principal (formulario): borde claro pero presente, fondo blanco, foco visible.
const INPUT =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30'

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
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="mt-0.5 block text-[10px] text-slate-400">{hint}</span>}
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
  // Convierte a Number para limpiar trailing zeros ("35.00" -> 35)
  const isFilled = value !== null && value !== undefined
  const display = isFilled ? Number(value) : ''
  return (
    <input
      type="number"
      step={step}
      placeholder={placeholder}
      value={display}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`${INPUT} ${isFilled ? 'has-value' : ''}`}
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
            {(['T/D', 'T/N'] as const).map((t) => {
              const selected = form.shift === t
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => update({ shift: t })}
                  className={`flex-1 rounded-md border px-3 py-1 text-sm font-semibold transition ${
                    selected
                      ? 'has-value'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              )
            })}
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

  // Reparte filas en dos columnas (mitad izda / mitad dcha)
  const half = Math.ceil(rows.length / 2)
  const leftRows = rows.slice(0, half)
  const rightRows = rows.slice(half)

  const renderTable = (data: Row[]) => (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
            <th className="w-1/2 py-3 pl-4 pr-2 font-semibold">Parámetro</th>
            <th className="px-3 py-3 font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, idx) => (
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
                    className={cellInputCls(r.get())}
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
  )

  return (
    <Section id="fisicos" title="Datos físicos" icon={Thermometer}>
      <div className="grid gap-4 md:grid-cols-2">
        {renderTable(leftRows)}
        {renderTable(rightRows)}
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
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
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

  // El valor de los defectos se trata como % (no como contador de piezas).
  const setDefectCount = (idx: number, defect_id: number, pct: number | null) => {
    const sampling = form.samplings[idx]
    const without = sampling.defects.filter((d) => d.defect_id !== defect_id)
    const next: SamplingDefectIO[] =
      pct == null || pct === 0
        ? without
        : [...without, { defect_id, percentage: pct }]
    updateSampling(idx, { defects: next })
  }

  // Cálculo auto: piezas totales sumadas (para el banner de cabecera)
  const totalPiezas = form.samplings.reduce((a, s) => a + (s.units_count ?? 0), 0)

  // Reparte defectos preimpresos en dos columnas (mitad / mitad)
  const halfP = Math.ceil(paperDefects.length / 2)
  const leftPaper = paperDefects.slice(0, halfP)
  const rightPaper = paperDefects.slice(halfP)
  // Defectos extras solo activos
  const activeExtras = otherDefects.filter((d) =>
    form.samplings.some((s) => s.defects.find((x) => x.defect_id === d.id)),
  )

  const renderDefectsTable = (defects: typeof paperDefects, extras: typeof otherDefects) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="muestreos-table w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700">
            <th className="py-2.5 pl-3 pr-2 font-bold">Defecto</th>
            <th className="w-20 px-2 py-2.5 text-center font-bold">1º</th>
            <th className="w-20 px-2 py-2.5 text-center font-bold">2º</th>
            <th className="w-20 px-2 py-2.5 text-center font-bold">3º</th>
          </tr>
        </thead>
        <tbody>
          {defects.map((d, idx) => (
            <DefectRow
              key={d.id}
              name={d.name}
              samplings={form.samplings}
              defectId={d.id}
              onSet={setDefectCount}
              zebra={idx % 2 === 1}
            />
          ))}
          {extras.map((d) => (
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
  )

  return (
    <Section
      id="muestreos"
      title="Muestreos (1, 2, 3)"
      icon={ListChecks}
      description="Defectos por muestreo según R-CC-001 — Total y % se calculan solos"
      action={
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 shadow-sm">
          <div className="text-right leading-tight">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              % defectos global
            </div>
            <div className="text-[10px] font-normal normal-case text-slate-400">
              del Excel — opcional
            </div>
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="—"
            value={form.global_defect_percentage ?? ''}
            onChange={(e) =>
              update({
                global_defect_percentage:
                  e.target.value === '' ? null : Number(e.target.value),
              })
            }
            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-right text-sm font-bold tabular-nums text-slate-900 outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/30"
          />
          <span className="text-sm font-bold text-slate-600">%</span>
        </div>
      }
    >
      {/* Banner de piezas totales: arriba, full-width, compartido */}
      <div className="mb-4 overflow-hidden rounded-xl border-2 border-cea-200 bg-cea-50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cea-200 text-left text-xs uppercase tracking-wider text-cea-800">
              <th className="py-2 pl-3 pr-2 font-bold">Piezas totales</th>
              <th className="w-20 px-2 py-2 text-center font-bold">1º muestreo</th>
              <th className="w-20 px-2 py-2 text-center font-bold">2º muestreo</th>
              <th className="w-20 px-2 py-2 text-center font-bold">3º muestreo</th>
              <th className="w-24 border-l-2 border-cea-200 bg-cea-100/60 px-3 py-2 text-right font-bold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2 pl-3 pr-2 text-xs text-cea-800">
                Piezas contadas en cada muestreo
              </td>
              {form.samplings.map((s, i) => (
                <td key={i} className="px-2 py-2 text-center">
                  <input
                    type="number"
                    step="1"
                    value={s.units_count ?? ''}
                    onChange={(e) =>
                      updateSampling(i, {
                        units_count: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className={cellInputCls(s.units_count)}
                  />
                </td>
              ))}
              <td className="border-l-2 border-cea-200 bg-cea-100/60 px-3 py-2 text-right text-sm font-bold text-cea-900">
                {totalPiezas > 0 ? totalPiezas.toLocaleString('es-EC') : '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Defectos en 2 columnas (mitad / mitad) */}
      <div className="grid gap-4 md:grid-cols-2">
        {renderDefectsTable(leftPaper, [])}
        {renderDefectsTable(rightPaper, activeExtras)}
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

// Helper: añade clase `has-value` a un input cuando tiene valor — para resaltar
function cellInputCls(val: unknown): string {
  return CELL_INPUT + (val !== null && val !== undefined && val !== '' ? ' has-value' : '')
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
      <td className="py-2 pl-3 pr-2 align-middle font-semibold text-slate-800">
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
        // El valor es %. Tras el import también puede estar en units_count
        // (datos antiguos), así que lo aceptamos como fallback.
        const raw = entry?.percentage ?? entry?.units_count ?? null
        // Convierte a Number para quitar trailing zeros ("16.00" → 16).
        const display = raw !== null ? Number(raw) : null
        return (
          <td
            key={i}
            className="border-l border-dashed border-slate-200 px-1.5 py-1.5 align-middle"
          >
            <div className="flex items-center justify-end gap-0.5">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={display ?? ''}
                onChange={(e) =>
                  onSet(i, defectId, e.target.value === '' ? null : Number(e.target.value))
                }
                className={cellInputCls(display)}
              />
              <span className="text-[10px] font-medium text-slate-400">%</span>
            </div>
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
    // Diferencia "key no enviada" vs "key explícitamente null" para que poder borrar
    const updated: SizeDistributionIO = {
      cc_classification_id: cc_id,
      weight_grams:
        'weight_grams' in patch ? patch.weight_grams ?? null : existing?.weight_grams ?? null,
      units_count:
        'units_count' in patch ? patch.units_count ?? null : existing?.units_count ?? null,
      average_grammage:
        'average_grammage' in patch
          ? patch.average_grammage ?? null
          : existing?.average_grammage ?? null,
    }
    // Si la fila queda vacía y no existía antes, no la creamos
    if (
      !existing &&
      updated.weight_grams == null &&
      updated.units_count == null &&
      updated.average_grammage == null
    ) {
      return
    }
    // Si la fila quedó completamente vacía, la quitamos del array
    if (
      updated.weight_grams == null &&
      updated.units_count == null &&
      updated.average_grammage == null
    ) {
      update({
        size_distribution: form.size_distribution.filter(
          (s) => s.cc_classification_id !== cc_id,
        ),
      })
      return
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

  // Reparte los rangos en 2 columnas (mitad / mitad)
  const halfR = Math.ceil(ranges.length / 2)
  const leftR = ranges.slice(0, halfR)
  const rightR = ranges.slice(halfR)

  const renderTable = (rs: typeof ranges) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-700">
            <th className="py-2 pl-3 pr-2 font-bold">Rango CC</th>
            <th className="px-2 py-2 text-center font-bold">Peso (g)</th>
            <th className="px-2 py-2 text-center font-bold">Piezas</th>
            <th className="px-2 py-2 text-center font-bold">Gramaje prom.</th>
          </tr>
        </thead>
        <tbody>
          {rs.map((c, idx) => {
            const e = form.size_distribution.find((s) => s.cc_classification_id === c.id)
            return (
              <tr
                key={c.id}
                className={`border-b border-slate-200 ${idx % 2 === 1 ? 'bg-slate-50' : 'bg-white'} hover:bg-cea-50/40 focus-within:!bg-cea-100 focus-within:shadow-[inset_3px_0_0_0_theme(colors.cea.700)]`}
              >
                <td className="py-1.5 pl-3 pr-2 align-middle font-semibold text-slate-800">
                  {c.name}
                </td>
                <td className="border-l border-dashed border-slate-200 px-2 py-1.5 text-right align-middle">
                  <input
                    type="number"
                    step="0.01"
                    value={e?.weight_grams ?? ''}
                    onChange={(ev) =>
                      setEntry(c.id, {
                        weight_grams: ev.target.value === '' ? null : Number(ev.target.value),
                      })
                    }
                    className={cellInputCls(e?.weight_grams)}
                  />
                </td>
                <td className="border-l border-dashed border-slate-200 px-2 py-1.5 text-right align-middle">
                  <input
                    type="number"
                    step="1"
                    value={e?.units_count ?? ''}
                    onChange={(ev) =>
                      setEntry(c.id, {
                        units_count: ev.target.value === '' ? null : Number(ev.target.value),
                      })
                    }
                    className={cellInputCls(e?.units_count)}
                  />
                </td>
                <td className="border-l border-dashed border-slate-200 px-2 py-1.5 text-right align-middle">
                  <input
                    type="number"
                    step="0.01"
                    value={e?.average_grammage ?? ''}
                    onChange={(ev) =>
                      setEntry(c.id, {
                        average_grammage: ev.target.value === '' ? null : Number(ev.target.value),
                      })
                    }
                    className={cellInputCls(e?.average_grammage)}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <Section
      id="histo"
      title="Distribución por clasificación CC"
      icon={BarChart3}
      description="Mini-histograma del R-CC-001 (la curva grande va al R-CC-034)"
    >
      <div className="grid gap-4 md:grid-cols-2">
        {renderTable(leftR)}
        {renderTable(rightR)}
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
      <div className="grid gap-2 lg:grid-cols-3">
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
            {(['ENTERO', 'COLA'] as const).map((p) => {
              const selected = form.destined_product_type === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    update({
                      destined_product_type: selected ? null : p,
                    })
                  }
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
                    selected
                      ? 'has-value'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              )
            })}
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

import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  FileText,
  Snowflake,
  SprayCan,
  Thermometer,
  Truck,
  User as UserIcon,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type { AttachmentRead, LotContext, LotReceptionInfo } from '../types/domain'

interface Props {
  ctx: LotContext
  onClose: () => void
}

export default function RecepcionDetalleModal({ ctx, onClose }: Props) {
  const photos = useQuery({
    queryKey: ['attachments', 'lot', ctx.lot_id],
    queryFn: async () =>
      (await api.get<AttachmentRead[]>(`/api/attachments?lot_id=${ctx.lot_id}`)).data,
  })

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cea-100 p-2 ring-1 ring-cea-200">
              <Truck className="h-5 w-5 text-cea-700" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Recepción del lote {ctx.lot_code}/{ctx.lot_year}
              </h2>
              <p className="text-xs text-slate-500">
                {ctx.receptions.length === 1
                  ? '1 entrega'
                  : `${ctx.receptions.length} entregas · ${Number(ctx.total_lbs ?? 0).toLocaleString('es-EC', { maximumFractionDigits: 0 })} lbs en total`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Body con scroll */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Lote — datos derivados de la recepción */}
          <Bloque title="Lote">
            <Grid>
              <Kv label="Proveedor" value={ctx.supplier_name} />
              <Kv label="Procedencia" value={ctx.origin_name} />
              <Kv label="PSC" value={ctx.psc} />
              <Kv label="Producto" value={ctx.product_type} />
              <Kv label="Químico aplicado" value={ctx.chemical_name} />
              <Kv
                label="Tratadores"
                value={ctx.treaters.length > 0 ? ctx.treaters.join(' · ') : null}
              />
              <Kv
                label="Fecha de pesca"
                value={ctx.fishing_date}
              />
              <Kv label="Total recibido" value={fmtLbs(ctx.total_lbs)} highlight />
            </Grid>
          </Bloque>

          {/* Cada entrega */}
          {ctx.receptions.map((r) => (
            <EntregaCard key={r.reception_id} r={r} />
          ))}

          {/* Decisión actual del lote (último análisis) — placeholder */}
          {/* TODO: incluir aquí decisión + fecha cuando el lot-context la traiga */}

          {/* Fotos */}
          <Bloque title={`Fotos del lote${photos.data ? ` (${photos.data.length})` : ''}`}>
            {photos.isLoading && (
              <p className="text-sm text-slate-500">Cargando…</p>
            )}
            {photos.data && photos.data.length === 0 && (
              <p className="text-sm italic text-slate-500">
                Sin fotos asociadas a este lote.
              </p>
            )}
            {photos.data && photos.data.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {photos.data.map((a) => {
                  const isImage = (a.mime_type ?? '').startsWith('image/')
                  return (
                    <a
                      key={a.attachment_id}
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                    >
                      {isImage ? (
                        <img
                          src={a.file_url}
                          alt={a.file_name ?? ''}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                          {a.file_name ?? 'archivo'}
                        </div>
                      )}
                    </a>
                  )
                })}
              </div>
            )}
          </Bloque>
        </div>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  )
}

function EntregaCard({ r }: { r: LotReceptionInfo }) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-cea-700 text-sm font-bold text-white">
            {r.delivery_index}
          </span>
          <div>
            <div className="text-sm font-bold text-slate-900">
              Entrega {r.delivery_index}
            </div>
            <div className="text-xs text-slate-500">
              {r.reception_date}
              {r.arrival_time && (
                <>
                  {' · '}
                  {r.arrival_time.slice(0, 5)}
                </>
              )}
              {r.plant_name && <> · {r.plant_name}</>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-base font-bold tabular-nums text-cea-700">
            {fmtLbs(r.received_lbs)}
          </div>
          {(r.boxes_count != null || r.bins_count != null) && (
            <div className="text-xs text-slate-500">
              {r.boxes_count != null && `${r.boxes_count} kavetas`}
              {r.bins_count != null && (r.boxes_count != null ? ` · ` : '') + `${r.bins_count} bines`}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kv label="Placa" value={r.plate_number} icon={Truck} />
        <Kv label="Chofer" value={r.driver_name} icon={UserIcon} />
        <Kv label="Logística" value={r.logistics_name} icon={Building2} />
        <Kv
          label="Temperatura llegada"
          value={r.arrival_temperature != null ? `${Number(r.arrival_temperature).toFixed(1)}°C` : null}
          icon={Thermometer}
        />
        <Kv label="Guía de remisión" value={r.remission_guide_number} icon={FileText} />
        <Kv label="Carta de garantía" value={r.warranty_letter_number} icon={FileText} />

        <CondPill label="Camión" value={r.truck_condition} icon={Truck} />
        <CondPill label="Hielo" value={r.ice_condition} icon={Snowflake} />
        <CondPill label="Higiene" value={r.hygiene_condition} icon={SprayCan} />

        {r.observations && (
          <div className="sm:col-span-2 lg:col-span-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Observaciones
            </div>
            <p className="mt-0.5 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-800">
              {r.observations}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── helpers UI ─────────────────────────────────────────────────────────

function Bloque({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  )
}

function Kv({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string
  value: string | number | null | undefined
  icon?: typeof Truck
  highlight?: boolean
}) {
  return (
    <div className="leading-tight">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="h-3 w-3 text-slate-400" />}
        {label}
      </div>
      <div
        className={`mt-0.5 truncate text-sm ${
          highlight ? 'font-bold text-cea-700' : 'font-semibold text-slate-900'
        }`}
        title={value ? String(value) : ''}
      >
        {value || '—'}
      </div>
    </div>
  )
}

function CondPill({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | null | undefined
  icon: typeof Truck
}) {
  const v = (value ?? '').toLowerCase()
  const tone =
    ['bueno', 'buena', 'suficiente'].includes(v)
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : v === 'regular'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : ['malo', 'mala', 'insuficiente', 'sin hielo'].includes(v)
          ? 'bg-red-50 text-red-700 ring-red-200'
          : 'bg-slate-50 text-slate-600 ring-slate-200'

  return (
    <div className="leading-tight">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <Icon className="h-3 w-3 text-slate-400" /> {label}
      </div>
      <span
        className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone}`}
      >
        {value || '—'}
      </span>
    </div>
  )
}

function fmtLbs(v: number | string | null | undefined): string {
  if (v == null) return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return '—'
  return `${n.toLocaleString('es-EC', { maximumFractionDigits: 0 })} lbs`
}


import { useQuery } from '@tanstack/react-query'
import { File, FileSpreadsheet, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react'
import { api } from '../../api/client'
import type { AnalysisRead, AnalysisUpsert, AttachmentRead } from '../../types/domain'
import type { AnalysisStats } from './TopCardsAnalisis'

interface Props {
  form: AnalysisUpsert
  analysisId: number | null
  ctx?: { lot_id: number } | null
  stats: AnalysisStats
  loadedAnalysis: AnalysisRead | null
  onOpenFiles: () => void
}

export default function SidebarAnalisis({
  form, analysisId, ctx, stats, loadedAnalysis, onOpenFiles,
}: Props) {
  // Archivos del lote
  const attachments = useQuery({
    queryKey: ['attachments', 'lot', ctx?.lot_id],
    queryFn: async () =>
      (await api.get<AttachmentRead[]>(`/api/attachments?lot_id=${ctx?.lot_id}`)).data,
    enabled: !!ctx?.lot_id,
  })

  // Resumen rápido (dots semáforo)
  const quickRows: { label: string; value: string; tone: 'good' | 'warn' | 'bad' | 'none' }[] = [
    {
      label: 'SO₂ global',
      value: form.so2_global != null ? `${form.so2_global}` : '—',
      tone: tonePerSO2(form.so2_global ?? null),
    },
    {
      label: 'Temperatura',
      value: form.product_temperature != null ? `${form.product_temperature} °C` : '—',
      tone: tonePerTemp(form.product_temperature ?? null),
    },
    {
      label: 'Gr CC',
      value: form.gr_cc != null ? `${form.gr_cc}` : '—',
      tone: tonePerGrCC(form.gr_cc ?? null),
    },
    {
      label: 'C/kg',
      value: form.c_kg != null ? `${form.c_kg}` : '—',
      tone: 'none',
    },
    {
      label: '% Defectos globales',
      value: form.global_defect_percentage != null ? `${form.global_defect_percentage}%` : '—',
      tone: tonePerDefects(form.global_defect_percentage ?? null),
    },
    {
      label: '% Camarón bueno',
      value: form.good_product_percentage != null ? `${form.good_product_percentage}%` : '—',
      tone: 'none',
    },
  ]

  return (
    <aside className="space-y-4">
      {/* Resumen del análisis */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Resumen del análisis
        </h3>
        <ProgressLine label="Progreso" pct={stats.progreso} />
        <Row label="Score de calidad" value={`${stats.score} / 100`} bold />
        <Row
          label="Riesgo"
          value={stats.riesgo}
          tone={stats.riesgo === 'Bajo' ? 'good' : stats.riesgo === 'Medio' ? 'warn' : 'bad'}
        />
        <Row label="Campos obligatorios" value={`${stats.filled} / ${stats.total}`} />
        <Row label="Campos pendientes" value={String(stats.pendientes)} />
        {loadedAnalysis?.updated_at && (
          <Row
            label="Última actualización"
            value={new Date(loadedAnalysis.updated_at).toLocaleString('es', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
            small
          />
        )}
      </section>

      {/* Resumen rápido */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Resumen rápido
        </h3>
        <dl className="space-y-1.5">
          {quickRows.map((q) => (
            <div key={q.label} className="flex items-center justify-between text-xs">
              <dt className="text-slate-500">{q.label}</dt>
              <dd className="flex items-center gap-1.5">
                <span className="font-semibold tabular-nums text-slate-900">{q.value}</span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    q.tone === 'good' ? 'bg-emerald-500' :
                    q.tone === 'warn' ? 'bg-amber-500' :
                    q.tone === 'bad' ? 'bg-rose-500' :
                    'bg-slate-300'
                  }`}
                />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Archivos y fotos */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Archivos y fotos
        </h3>
        <button
          onClick={onOpenFiles}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 py-3 text-xs font-medium text-slate-600 transition hover:border-cea-500 hover:bg-cea-50 hover:text-cea-700"
        >
          <Upload className="h-4 w-4" />
          Añadir archivo
          <span className="text-slate-400">o arrastra aquí</span>
        </button>

        <ul className="mt-3 space-y-1.5">
          {attachments.isLoading && (
            <li className="text-[11px] text-slate-400">Cargando archivos…</li>
          )}
          {!attachments.isLoading && (attachments.data ?? []).length === 0 && (
            <li className="text-[11px] text-slate-400">Sin archivos todavía</li>
          )}
          {(attachments.data ?? []).slice(0, 5).map((a) => {
            const Icon = iconFor(a.mime_type)
            return (
              <li
                key={a.attachment_id}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                <a
                  href={a.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 truncate text-slate-700 hover:text-cea-700"
                  title={a.file_name ?? ''}
                >
                  {a.file_name ?? 'archivo'}
                </a>
                <button
                  type="button"
                  className="text-slate-400 hover:text-rose-600"
                  title="Eliminar"
                  onClick={onOpenFiles}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            )
          })}
          {(attachments.data ?? []).length > 5 && (
            <li className="text-center text-[11px] text-slate-400">
              + {attachments.data!.length - 5} más
            </li>
          )}
        </ul>
      </section>

      {/* Historial básico (con timestamps que ya tenemos) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Historial
        </h3>
        {loadedAnalysis ? (
          <ul className="space-y-2.5 text-xs">
            {loadedAnalysis.status === 'validado' && (
              <HistoryItem
                date={loadedAnalysis.updated_at}
                label="Validado"
                detail="Análisis cerrado"
                color="emerald"
              />
            )}
            {loadedAnalysis.status === 'rechazado' && (
              <HistoryItem
                date={loadedAnalysis.updated_at}
                label="Rechazado"
                detail="Análisis cerrado"
                color="rose"
              />
            )}
            {loadedAnalysis.status === 'borrador' && loadedAnalysis.updated_at !== loadedAnalysis.created_at && (
              <HistoryItem
                date={loadedAnalysis.updated_at}
                label="Guardado borrador"
                detail="Última edición"
                color="slate"
              />
            )}
            <HistoryItem
              date={loadedAnalysis.created_at}
              label="Creado"
              detail={`Análisis #${analysisId}`}
              color="cea"
            />
          </ul>
        ) : (
          <p className="text-[11px] text-slate-400">
            Análisis nuevo — sin historial todavía.
          </p>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          (Iteración 3: log completo desde tabla audit)
        </p>
      </section>
    </aside>
  )
}

// ───────── helpers ─────────

function tonePerSO2(v: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (v == null || v === 0) return 'none'
  if (v > 100) return 'bad'
  if (v < 30) return 'warn'
  return 'good'
}
function tonePerTemp(v: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (v == null) return 'none'
  if (v > 4) return 'bad'
  if (v > 2) return 'warn'
  return 'good'
}
function tonePerGrCC(v: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (v == null || v === 0) return 'none'
  if (v < 10 || v > 50) return 'bad'
  return 'good'
}
function tonePerDefects(v: number | null): 'good' | 'warn' | 'bad' | 'none' {
  if (v == null) return 'none'
  if (v > 40) return 'bad'
  if (v > 25) return 'warn'
  return 'good'
}

function iconFor(mime: string | null) {
  if (!mime) return File
  if (mime.startsWith('image/')) return ImageIcon
  if (mime.includes('pdf')) return FileText
  if (mime.includes('sheet') || mime.includes('excel')) return FileSpreadsheet
  return File
}

function ProgressLine({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold tabular-nums text-slate-900">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 75 ? '#16a34a' : pct >= 50 ? '#f59e0b' : '#dc2626',
          }}
        />
      </div>
    </div>
  )
}

function Row({
  label, value, tone, bold, small,
}: {
  label: string; value: string
  tone?: 'good' | 'warn' | 'bad'
  bold?: boolean
  small?: boolean
}) {
  const cls =
    tone === 'good' ? 'text-emerald-700' :
    tone === 'warn' ? 'text-amber-600' :
    tone === 'bad'  ? 'text-rose-600'    : 'text-slate-900'
  return (
    <div className={`flex items-center justify-between py-1 ${small ? 'text-[11px]' : 'text-xs'}`}>
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${bold ? 'font-bold' : 'font-medium'} ${cls}`}>{value}</dd>
    </div>
  )
}

function HistoryItem({
  date, label, detail, color,
}: {
  date: string
  label: string
  detail?: string
  color: 'emerald' | 'rose' | 'cea' | 'slate'
}) {
  const dotCls =
    color === 'emerald' ? 'bg-emerald-500' :
    color === 'rose'    ? 'bg-rose-500'    :
    color === 'cea'     ? 'bg-cea-600'     :
    'bg-slate-400'
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotCls}`} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-900">{label}</p>
        <p className="text-[11px] text-slate-500">
          {new Date(date).toLocaleString('es', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        {detail && <p className="text-[11px] text-slate-400">{detail}</p>}
      </div>
    </li>
  )
}

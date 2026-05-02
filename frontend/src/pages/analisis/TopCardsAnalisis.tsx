import { AlertTriangle, ListChecks, ShieldCheck } from 'lucide-react'
import type { AnalysisUpsert } from '../../types/domain'

/**
 * 4 cards top del mockup:
 *   1. Progreso del análisis (donut)
 *   2. Campos pendientes
 *   3. Alertas dinámicas (lista corta)
 *   4. Score de calidad + riesgo (donut)
 *
 * Todos los cálculos en frontend. En iteración 3 las alertas vendrán
 * de quality_rules dinámicas.
 */

export interface AnalysisStats {
  progreso: number       // 0-100 % de campos completados
  filled: number
  total: number
  pendientes: number
  alerts: { code: string; label: string; severity: 'critical' | 'warn' }[]
  score: number          // 0-100
  riesgo: 'Bajo' | 'Medio' | 'Alto'
}

export function calcAnalysisStats(form: AnalysisUpsert): AnalysisStats {
  // Campos obligatorios típicos del R-CC-001 (ajustable)
  const required: { value: unknown; key: string }[] = [
    { value: form.plant_id, key: 'plant_id' },
    { value: form.analysis_date, key: 'analysis_date' },
    { value: form.analysis_time, key: 'analysis_time' },
    { value: form.shift, key: 'shift' },
    { value: form.sample_total_weight, key: 'sample_total_weight' },
    { value: form.total_units, key: 'total_units' },
    { value: form.global_grammage, key: 'global_grammage' },
    { value: form.so2_residual_ppm, key: 'so2_residual' },
    { value: form.so2_global, key: 'so2_global' },
    { value: form.average_grammage, key: 'avg_grammage' },
    { value: form.product_temperature, key: 'temperature' },
    { value: form.gr_cc, key: 'gr_cc' },
    { value: form.c_kg, key: 'c_kg' },
    { value: form.gr_sc, key: 'gr_sc' },
    { value: form.c_kg2, key: 'c_kg2' },
    { value: form.colors.find((c) => c.sample_state === 'cocido')?.color_id, key: 'color_cocido' },
    { value: form.colors.find((c) => c.sample_state === 'crudo')?.color_id, key: 'color_crudo' },
    { value: form.flavors.find((f) => f.sample_state === 'cocido'), key: 'sabor_cocido' },
    { value: form.flavors.find((f) => f.sample_state === 'crudo'), key: 'sabor_crudo' },
    { value: form.samplings[0]?.units_count, key: 'muestreo_1_units' },
    { value: form.global_defect_percentage, key: 'pct_defectos' },
    { value: form.good_product_percentage, key: 'pct_bueno' },
    { value: form.decision_id, key: 'decision' },
    { value: form.destined_product_type, key: 'producto_destinado' },
  ]
  const filled = required.filter((r) => isFilled(r.value)).length
  const total = required.length
  const pendientes = total - filled
  const progreso = Math.round((filled / total) * 100)

  // Alertas heurísticas (en iteración 3 vendrán de quality_rules)
  const alerts: AnalysisStats['alerts'] = []
  if (typeof form.so2_global === 'number' && form.so2_global > 100)
    alerts.push({ code: 'so2_high', label: `SO₂ global alto (${form.so2_global} ppm)`, severity: 'critical' })
  if (typeof form.so2_global === 'number' && form.so2_global < 30 && form.so2_global > 0)
    alerts.push({ code: 'so2_low', label: `SO₂ global bajo (${form.so2_global} ppm)`, severity: 'warn' })
  if (typeof form.product_temperature === 'number' && form.product_temperature > 4)
    alerts.push({ code: 'temp_high', label: `Temperatura > 4 °C (${form.product_temperature})`, severity: 'critical' })
  if (typeof form.global_defect_percentage === 'number' && form.global_defect_percentage > 40)
    alerts.push({ code: 'defect_high', label: `Defectos globales altos (${form.global_defect_percentage}%)`, severity: 'critical' })
  if (typeof form.global_defect_percentage === 'number' && form.global_defect_percentage > 25 && form.global_defect_percentage <= 40)
    alerts.push({ code: 'defect_warn', label: `Defectos globales elevados (${form.global_defect_percentage}%)`, severity: 'warn' })
  if (typeof form.gr_cc === 'number' && (form.gr_cc < 10 || form.gr_cc > 50))
    alerts.push({ code: 'gr_cc_oor', label: `Gr CC fuera de rango (${form.gr_cc})`, severity: 'warn' })

  // Score 0-100: 100 - (defectos * 0.6) - (5 puntos por alerta crítica) - (2 por warn)
  let score = 100
  if (typeof form.global_defect_percentage === 'number')
    score -= Math.min(form.global_defect_percentage * 0.6, 30)
  for (const a of alerts) score -= a.severity === 'critical' ? 5 : 2
  score = Math.max(0, Math.min(100, Math.round(score)))

  const riesgo: AnalysisStats['riesgo'] =
    score >= 75 ? 'Bajo' : score >= 50 ? 'Medio' : 'Alto'

  return { progreso, filled, total, pendientes, alerts, score, riesgo }
}

function isFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0
  if (typeof v === 'object') return true
  return Boolean(v)
}

// ───────── UI ─────────

export default function TopCardsAnalisis({ stats }: { stats: AnalysisStats }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      <CardProgreso pct={stats.progreso} />
      <CardPendientes pendientes={stats.pendientes} total={stats.total} />
      <CardAlertas alerts={stats.alerts} />
      <CardScore score={stats.score} riesgo={stats.riesgo} />
    </div>
  )
}

function CardProgreso({ pct }: { pct: number }) {
  return (
    <div className="fade-in flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <DonutMini value={pct} color="#2563eb" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Progreso del análisis
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{pct}%</p>
      </div>
    </div>
  )
}

function CardPendientes({ pendientes, total }: { pendientes: number; total: number }) {
  const tone = pendientes === 0 ? 'text-emerald-600 bg-emerald-50' : pendientes <= 5 ? 'text-amber-600 bg-amber-50' : 'text-rose-600 bg-rose-50'
  return (
    <div className="fade-in flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`shrink-0 rounded-lg p-3 ${tone}`}>
        <ListChecks className="h-6 w-6" strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Campos pendientes
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{pendientes}</p>
        <p className="text-[11px] text-slate-400">de {total} obligatorios</p>
      </div>
    </div>
  )
}

function CardAlertas({ alerts }: { alerts: AnalysisStats['alerts'] }) {
  const ok = alerts.length === 0
  return (
    <div className="fade-in flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`shrink-0 rounded-lg p-3 ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
        {ok ? <ShieldCheck className="h-6 w-6" strokeWidth={2.5} /> : <AlertTriangle className="h-6 w-6" strokeWidth={2.5} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Alertas
        </p>
        {ok ? (
          <p className="mt-1 text-sm font-semibold text-emerald-700">Sin alertas activas</p>
        ) : (
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {alerts.slice(0, 3).map((a) => (
              <li key={a.code} className="flex items-start gap-1">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    a.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                  }`}
                />
                <span className="truncate">{a.label}</span>
              </li>
            ))}
            {alerts.length > 3 && (
              <li className="text-[11px] text-slate-400">+{alerts.length - 3} más</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

function CardScore({ score, riesgo }: { score: number; riesgo: AnalysisStats['riesgo'] }) {
  const ringColor =
    score >= 75 ? '#16a34a' :
    score >= 50 ? '#f59e0b' :
                  '#dc2626'
  const labelTone =
    riesgo === 'Bajo' ? 'text-emerald-700' :
    riesgo === 'Medio' ? 'text-amber-600' :
    'text-rose-600'
  return (
    <div className="fade-in flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <DonutMini value={score} color={ringColor} suffix="/100" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Score de calidad
        </p>
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">
          {score}
          <span className="ml-1 text-base font-medium text-slate-400">/100</span>
        </p>
        <p className="text-[11px]">
          Riesgo: <span className={`font-semibold ${labelTone}`}>{riesgo}</span>
        </p>
      </div>
    </div>
  )
}

function DonutMini({ value, color, suffix }: { value: number; color: string; suffix?: string }) {
  const size = 80
  const stroke = 8
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
      />
      <text
        x="50%" y="50%" dy="0.35em" textAnchor="middle"
        className="fill-slate-900"
        style={{ fontSize: 18, fontWeight: 700 }}
      >
        {Math.round(value)}{!suffix && '%'}
      </text>
    </svg>
  )
}

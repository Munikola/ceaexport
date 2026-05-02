/**
 * Donut de puntuación 0-100 con color según banda y etiqueta semántica.
 * - 75-100  → verde     "Excelente"
 * - 50-74   → ámbar     "Aceptable"
 * - 0-49    → rojo      "Crítico"
 */
interface Props {
  score: number
  size?: number
  state?: string // sobreescribe la etiqueta automática
}

export default function ScoreDonut({ score, size = 96, state }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const tier =
    clamped >= 75 ? 'excelente' :
    clamped >= 50 ? 'aceptable' : 'critico'
  const colors = {
    excelente: { ring: '#16a34a', text: 'text-emerald-700', label: 'Excelente' },
    aceptable: { ring: '#f59e0b', text: 'text-amber-600', label: 'Aceptable' },
    critico:   { ring: '#dc2626', text: 'text-rose-600',   label: 'Crítico' },
  }[tier]

  // Cálculos del arco (stroke-dasharray)
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = (clamped / 100) * circumference

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="#e2e8f0" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={colors.ring} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
        <text
          x="50%" y="50%" dy="0.35em"
          textAnchor="middle"
          className="fill-slate-900"
          style={{ fontSize: size * 0.28, fontWeight: 700 }}
        >
          {clamped}
        </text>
        <text
          x="50%" y="68%"
          textAnchor="middle"
          fill="#94a3b8"
          style={{ fontSize: size * 0.13 }}
        >
          /100
        </text>
      </svg>
      <div>
        <p className="text-xs font-medium text-slate-500">Estado general</p>
        <p className={`text-xl font-bold ${colors.text}`}>{state ?? colors.label}</p>
      </div>
    </div>
  )
}

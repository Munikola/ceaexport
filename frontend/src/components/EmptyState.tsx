import { type ReactNode } from 'react'

/**
 * Empty state con ilustración SVG simple en vez del icono triste de antes.
 * Ofrece title, description opcional y action opcional.
 */
interface Props {
  title?: string
  description?: string
  action?: ReactNode
  variant?: 'chart' | 'table' | 'inbox' | 'search'
  loading?: boolean
}

export default function EmptyState({
  title,
  description,
  action,
  variant = 'chart',
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <div className="flex gap-1.5" aria-label="Cargando">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-2.5 w-2.5 rounded-full bg-slate-300"
              style={{
                animation: 'bounce 1s infinite',
                animationDelay: `${delay}ms`,
              }}
            />
          ))}
        </div>
        <p className="text-xs text-slate-400">Cargando datos…</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <Illustration variant={variant} />
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600">{title ?? 'Sin datos'}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}

function Illustration({ variant }: { variant: Props['variant'] }) {
  const common = 'h-20 w-20'

  if (variant === 'chart') {
    // Chart bars con magnifying glass
    return (
      <svg className={common} viewBox="0 0 80 80" fill="none">
        <rect x="10" y="50" width="10" height="20" rx="2" fill="#e2e8f0" />
        <rect x="24" y="40" width="10" height="30" rx="2" fill="#cbd5e1" />
        <rect x="38" y="30" width="10" height="40" rx="2" fill="#e2e8f0" />
        <rect x="52" y="45" width="10" height="25" rx="2" fill="#cbd5e1" />
        <line x1="6" y1="70" x2="68" y2="70" stroke="#94a3b8" strokeWidth="1.5" />
        <circle cx="60" cy="22" r="10" stroke="#94a3b8" strokeWidth="2" fill="white" />
        <line x1="68" y1="30" x2="72" y2="34" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <line x1="55" y1="22" x2="65" y2="22" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="60" y1="17" x2="60" y2="27" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  if (variant === 'table') {
    return (
      <svg className={common} viewBox="0 0 80 80" fill="none">
        <rect x="12" y="18" width="56" height="44" rx="4" fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1="12" y1="30" x2="68" y2="30" stroke="#e2e8f0" strokeWidth="1.5" />
        <line x1="40" y1="18" x2="40" y2="62" stroke="#e2e8f0" strokeWidth="1.5" />
        <rect x="16" y="35" width="20" height="3" rx="1" fill="#e2e8f0" />
        <rect x="44" y="35" width="20" height="3" rx="1" fill="#e2e8f0" />
        <rect x="16" y="44" width="14" height="3" rx="1" fill="#e2e8f0" />
        <rect x="44" y="44" width="18" height="3" rx="1" fill="#e2e8f0" />
        <rect x="16" y="53" width="22" height="3" rx="1" fill="#e2e8f0" />
        <rect x="44" y="53" width="14" height="3" rx="1" fill="#e2e8f0" />
      </svg>
    )
  }
  if (variant === 'inbox') {
    return (
      <svg className={common} viewBox="0 0 80 80" fill="none">
        <path d="M 14 44 v 18 a 4 4 0 0 0 4 4 h 44 a 4 4 0 0 0 4 -4 v -18" stroke="#94a3b8" strokeWidth="1.5" fill="white" />
        <path d="M 14 44 l 8 -22 a 2 2 0 0 1 2 -1 h 32 a 2 2 0 0 1 2 1 l 8 22" stroke="#94a3b8" strokeWidth="1.5" fill="#f8fafc" />
        <path d="M 14 44 h 14 v 6 a 2 2 0 0 0 2 2 h 20 a 2 2 0 0 0 2 -2 v -6 h 14" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
      </svg>
    )
  }
  // search default
  return (
    <svg className={common} viewBox="0 0 80 80" fill="none">
      <circle cx="34" cy="34" r="18" stroke="#94a3b8" strokeWidth="2" fill="white" />
      <line x1="48" y1="48" x2="62" y2="62" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <line x1="28" y1="34" x2="40" y2="34" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
      <line x1="34" y1="28" x2="34" y2="40" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

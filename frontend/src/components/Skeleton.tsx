/**
 * Placeholder pulsante para mientras carga el dato real.
 * Sustituye al guion '—' o 'Cargando…' que se veía pobre.
 */
interface Props {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

export default function Skeleton({ className = '', rounded = 'md' }: Props) {
  const r = {
    sm: 'rounded',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded]
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] ${r} ${className}`}
      style={{ animation: 'shimmer 1.6s ease-in-out infinite' }}
    />
  )
}

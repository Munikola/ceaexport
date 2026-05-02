import { Star } from 'lucide-react'

/**
 * Rating de 1-5 estrellas (impresión visual rápida del recepción).
 * Click para cambiar; hover para previsualizar.
 */
interface Props {
  value: number | null | undefined
  onChange?: (v: number) => void
  size?: number
  readOnly?: boolean
}

export default function StarRating({ value, onChange, size = 16, readOnly = false }: Props) {
  const v = value ?? 0
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`Calidad ${v} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= v
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(n === v ? 0 : n)}
            className={`transition ${readOnly ? '' : 'hover:scale-110'} ${filled ? 'text-amber-400' : 'text-slate-300'}`}
            aria-label={`${n} estrellas`}
          >
            <Star
              className={filled ? 'fill-current' : ''}
              style={{ width: size, height: size }}
              strokeWidth={2}
            />
          </button>
        )
      })}
    </div>
  )
}

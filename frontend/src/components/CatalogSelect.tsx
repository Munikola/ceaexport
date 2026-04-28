import { useCatalog } from '../hooks/useCatalogs'
import type { CatalogName } from '../types/domain'

interface Props {
  catalog: CatalogName
  value: number | null | undefined
  onChange: (id: number | null) => void
  label?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  /** Filtra los items según `extra` (ej. ponds por supplier_id) */
  filter?: (extra: Record<string, unknown>) => boolean
}

export default function CatalogSelect({
  catalog,
  value,
  onChange,
  label,
  required,
  disabled,
  placeholder = 'Seleccionar…',
  filter,
}: Props) {
  const q = useCatalog(catalog)
  const items = filter ? (q.data ?? []).filter((i) => filter(i.extra)) : q.data ?? []

  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        value={value ?? ''}
        required={required}
        disabled={disabled || q.isLoading}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20 disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="">{q.isLoading ? 'Cargando…' : placeholder}</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </div>
  )
}

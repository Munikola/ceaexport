import { useState, useRef, useEffect } from 'react'
import { Plus, Check } from 'lucide-react'
import { useCatalog, useCreateCatalogItem } from '../hooks/useCatalogs'
import type { CatalogName } from '../types/domain'

interface Props {
  catalog: CatalogName
  value: number | null | undefined
  onChange: (id: number | null) => void
  label?: string
  required?: boolean
  placeholder?: string
  allowCreate?: boolean
  /** Campos extra a enviar cuando se crea un nuevo registro */
  createExtra?: Record<string, unknown>
}

export default function CatalogAutocomplete({
  catalog,
  value,
  onChange,
  label,
  required,
  placeholder = 'Buscar…',
  allowCreate = true,
  createExtra,
}: Props) {
  const q = useCatalog(catalog)
  const create = useCreateCatalogItem(catalog)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const items = q.data ?? []
  const selected = items.find((i) => i.id === value)
  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items
  const exactMatch = filtered.find((i) => i.name.toLowerCase() === search.toLowerCase())

  useEffect(() => {
    if (selected && !search) setSearch(selected.name)
  }, [selected, search])

  // Cerrar al click fuera
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const select = (id: number, name: string) => {
    onChange(id)
    setSearch(name)
    setOpen(false)
  }

  const createNew = async () => {
    if (!search.trim()) return
    const created = await create.mutateAsync({
      name: search.trim(),
      extra: createExtra ?? {},
    })
    select(created.id, created.name)
  }

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange(null)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
      />
      {selected && !open && (
        <Check className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
      )}

      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 && !allowCreate && (
            <p className="px-3 py-2 text-xs text-slate-500">Sin resultados</p>
          )}
          {filtered.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => select(i.id, i.name)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cea-50 ${i.id === value ? 'bg-cea-50' : ''}`}
            >
              {i.name}
              {i.id === value && <Check className="ml-auto h-3.5 w-3.5 text-emerald-600" />}
            </button>
          ))}
          {allowCreate && search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createNew}
              disabled={create.isPending}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm text-cea-700 hover:bg-cea-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Añadir <strong>{search.trim()}</strong>
              {create.isPending && <span className="ml-auto text-xs">…</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

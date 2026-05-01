import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, X, ChevronDown, Search, Check } from 'lucide-react'
import { useCatalog, useCreateCatalogItem } from '../hooks/useCatalogs'
import type { CatalogName } from '../types/domain'

interface Props {
  catalog: CatalogName
  value: number[]
  onChange: (ids: number[]) => void
  label?: string
  required?: boolean
  placeholder?: string
  allowCreate?: boolean
  /** Campos extra para enviar al crear */
  createExtra?: Record<string, unknown>
  /** ¿Algún item del catálogo se debería pinear arriba? (ej. "PROVEEDOR" en treaters) */
  pinTopMatching?: (extra: Record<string, unknown>) => boolean
}

export default function CatalogMultiSelect({
  catalog,
  value,
  onChange,
  label,
  required,
  placeholder = 'Buscar y seleccionar…',
  allowCreate = true,
  createExtra,
  pinTopMatching,
}: Props) {
  const q = useCatalog(catalog)
  const create = useCreateCatalogItem(catalog)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = q.data ?? []

  const selectedItems = useMemo(
    () => items.filter((i) => value.includes(i.id)),
    [items, value],
  )

  const filtered = useMemo(() => {
    const lower = search.toLowerCase().trim()
    let list = items.filter((i) => !value.includes(i.id))
    if (lower) {
      list = list.filter((i) => i.name.toLowerCase().includes(lower))
    }
    // Pin items "destacados" (ej. PROVEEDOR) arriba
    if (pinTopMatching) {
      list.sort((a, b) => {
        const aPinned = pinTopMatching(a.extra)
        const bPinned = pinTopMatching(b.extra)
        if (aPinned && !bPinned) return -1
        if (!aPinned && bPinned) return 1
        return a.name.localeCompare(b.name)
      })
    }
    return list
  }, [items, value, search, pinTopMatching])

  const exactMatch = filtered.find(
    (i) => i.name.toLowerCase() === search.toLowerCase().trim(),
  )

  // Cerrar al click fuera
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  const remove = (id: number) => {
    onChange(value.filter((v) => v !== id))
  }

  const createNew = async () => {
    const name = search.trim()
    if (!name) return
    const created = await create.mutateAsync({ name, extra: createExtra ?? {} })
    onChange([...value, created.id])
    setSearch('')
    inputRef.current?.focus()
  }

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Caja con chips + buscador */}
      <div
        className={`flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 transition ${
          open
            ? 'border-cea-500 ring-2 ring-cea-500/20'
            : 'border-slate-300 hover:border-slate-400'
        }`}
        onClick={() => {
          setOpen(true)
          inputRef.current?.focus()
        }}
      >
        {selectedItems.map((item) => (
          <span
            key={item.id}
            className="flex items-center gap-1 rounded-md bg-cea-100 px-2 py-0.5 text-xs font-medium text-cea-800"
          >
            {item.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                remove(item.id)
              }}
              className="rounded p-0.5 hover:bg-cea-200"
              aria-label={`Quitar ${item.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={selectedItems.length === 0 ? placeholder : ''}
          className="min-w-[80px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400"
        />
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {filtered.length === 0 && !allowCreate && (
            <p className="px-3 py-2 text-xs text-slate-500">Sin resultados</p>
          )}

          {/* Hint inicial cuando no hay búsqueda y hay muchos */}
          {!search && filtered.length > 12 && (
            <div className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
              <Search className="mr-1 inline h-3 w-3" /> {filtered.length} disponibles. Escribe para filtrar.
            </div>
          )}

          {filtered.map((i) => {
            const pinned = pinTopMatching?.(i.extra) ?? false
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => toggle(i.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cea-50 ${
                  pinned ? 'font-medium text-cea-800' : 'text-slate-700'
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-300">
                  {/* checkbox vacío — los seleccionados están como chips arriba */}
                </span>
                <span className="truncate">{i.name}</span>
                {pinned && (
                  <span className="ml-auto rounded bg-cea-100 px-1.5 py-0.5 text-[10px] text-cea-700">
                    destacado
                  </span>
                )}
              </button>
            )
          })}

          {/* Items seleccionados al final con check */}
          {selectedItems.length > 0 && search === '' && (
            <>
              <div className="mt-1 border-t border-slate-100 px-3 pb-1 pt-2 text-[11px] uppercase tracking-wide text-slate-400">
                Seleccionados ({selectedItems.length})
              </div>
              {selectedItems.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggle(i.id)}
                  className="flex w-full items-center gap-2 bg-cea-50/50 px-3 py-1.5 text-left text-sm text-cea-800 hover:bg-cea-100"
                >
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span className="truncate">{i.name}</span>
                </button>
              ))}
            </>
          )}

          {/* Crear nuevo */}
          {allowCreate && search.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createNew}
              disabled={create.isPending}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-medium text-cea-700 hover:bg-cea-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                Añadir <strong>{search.trim()}</strong>
              </span>
              {create.isPending && <span className="ml-auto text-xs">…</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

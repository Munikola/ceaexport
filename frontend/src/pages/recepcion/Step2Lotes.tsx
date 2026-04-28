import { Plus, Trash2, Copy } from 'lucide-react'
import type { LotInReceptionCreate, ProductType } from '../../types/domain'
import CatalogSelect from '../../components/CatalogSelect'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'
import { useCatalog } from '../../hooks/useCatalogs'

interface Props {
  lots: Partial<LotInReceptionCreate>[]
  onChange: (lots: Partial<LotInReceptionCreate>[]) => void
}

export default function Step2Lotes({ lots, onChange }: Props) {
  const treaters = useCatalog('treaters')

  const updateLot = (idx: number, patch: Partial<LotInReceptionCreate>) => {
    onChange(lots.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  const addLot = () => onChange([...lots, {}])
  const removeLot = (idx: number) => onChange(lots.filter((_, i) => i !== idx))
  const duplicateLot = (idx: number) => {
    const copy = { ...lots[idx], lot_code: '' } // forzar a re-introducir el código
    onChange([...lots.slice(0, idx + 1), copy, ...lots.slice(idx + 1)])
  }

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Lotes del camión</h2>
          <p className="text-sm text-slate-500">¿Cuántos lotes trae este camión? Añade uno por cada uno.</p>
        </div>
        <button
          onClick={addLot}
          className="flex items-center gap-1 rounded-xl bg-cea-700 px-3 py-2 text-sm font-medium text-white hover:bg-cea-800"
        >
          <Plus className="h-4 w-4" /> Añadir lote
        </button>
      </div>

      <div className="space-y-4">
        {lots.map((lot, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Lote #{idx + 1}</h3>
              <div className="flex gap-1">
                <button
                  onClick={() => duplicateLot(idx)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                  title="Duplicar"
                >
                  <Copy className="h-4 w-4" />
                </button>
                {lots.length > 1 && (
                  <button
                    onClick={() => removeLot(idx)}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Código de lote" required>
                <input
                  type="text"
                  required
                  value={lot.lot_code ?? ''}
                  onChange={(e) => updateLot(idx, { lot_code: e.target.value })}
                  placeholder="Ej. 1233"
                  className={INPUT}
                />
              </Field>

              <Field label="Lote cliente">
                <input
                  type="text"
                  value={lot.client_lot_code ?? ''}
                  onChange={(e) => updateLot(idx, { client_lot_code: e.target.value || null })}
                  className={INPUT}
                />
              </Field>

              <CatalogSelect
                catalog="lot-categories"
                label="Categoría"
                value={lot.lot_category_id}
                onChange={(id) => updateLot(idx, { lot_category_id: id })}
              />

              <Field label="Tipo de producto" required>
                <div className="flex gap-2">
                  {(['ENTERO', 'COLA'] as ProductType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateLot(idx, { product_type: p })}
                      className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        lot.product_type === p
                          ? 'border-cea-700 bg-cea-700 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </Field>

              <CatalogAutocomplete
                catalog="suppliers"
                label="Proveedor"
                required
                value={lot.supplier_id}
                onChange={(id) => updateLot(idx, { supplier_id: id ?? undefined })}
              />

              <CatalogAutocomplete
                catalog="origins"
                label="Procedencia"
                value={lot.origin_id}
                onChange={(id) => updateLot(idx, { origin_id: id })}
              />

              <CatalogAutocomplete
                catalog="ponds"
                label="Piscina (PSC)"
                value={lot.pond_id}
                onChange={(id) => updateLot(idx, { pond_id: id })}
                createExtra={{
                  supplier_id: lot.supplier_id,
                  origin_id: lot.origin_id,
                }}
              />

              <CatalogSelect
                catalog="chemicals"
                label="Producto químico"
                value={lot.chemical_id}
                onChange={(id) => updateLot(idx, { chemical_id: id })}
              />

              <Field label="Libras recibidas" required>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={lot.received_lbs ?? ''}
                  onChange={(e) =>
                    updateLot(idx, {
                      received_lbs: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={INPUT}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Nº kavetas">
                  <input
                    type="number"
                    value={lot.boxes_count ?? ''}
                    onChange={(e) =>
                      updateLot(idx, {
                        boxes_count: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={INPUT}
                  />
                </Field>
                <Field label="Nº bines">
                  <input
                    type="number"
                    value={lot.bins_count ?? ''}
                    onChange={(e) =>
                      updateLot(idx, {
                        bins_count: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className={INPUT}
                  />
                </Field>
              </div>

              <Field label="Fecha de pesca">
                <input
                  type="date"
                  value={lot.fishing_date ?? ''}
                  onChange={(e) => updateLot(idx, { fishing_date: e.target.value || null })}
                  className={INPUT}
                />
              </Field>

              <Field label="Tratadores">
                <div className="flex flex-wrap gap-1.5">
                  {(treaters.data ?? []).map((t) => {
                    const selected = (lot.treater_ids ?? []).includes(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          const current = lot.treater_ids ?? []
                          updateLot(idx, {
                            treater_ids: selected
                              ? current.filter((id) => id !== t.id)
                              : [...current, t.id],
                          })
                        }}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          selected
                            ? 'border-cea-700 bg-cea-700 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {t.name}
                      </button>
                    )
                  })}
                </div>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Observaciones">
                  <textarea
                    rows={2}
                    value={lot.observations ?? ''}
                    onChange={(e) => updateLot(idx, { observations: e.target.value || null })}
                    className={INPUT}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}

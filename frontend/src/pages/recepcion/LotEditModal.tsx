import { useState } from 'react'
import { X, Save } from 'lucide-react'
import type { LotInReceptionCreate, ProductType } from '../../types/domain'
import CatalogSelect from '../../components/CatalogSelect'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'
import CatalogMultiSelect from '../../components/CatalogMultiSelect'
import StarRating from '../../components/StarRating'

// Tipo extendido — añadimos quality_visual (estrellas, no se persiste por ahora,
// queda en observations como parte del JSON local del UI)
export type LotDraft = Partial<LotInReceptionCreate> & {
  quality_visual?: number | null
}

interface Props {
  initial: LotDraft
  index: number
  onSave: (lot: LotDraft) => void
  onClose: () => void
}

const INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20'

export default function LotEditModal({ initial, index, onSave, onClose }: Props) {
  const [lot, setLot] = useState<LotDraft>(initial)

  const set = <K extends keyof LotDraft>(k: K, v: LotDraft[K]) =>
    setLot((p) => ({ ...p, [k]: v }))

  const canSave = !!lot.lot_code && !!lot.supplier_id && !!lot.product_type && (lot.received_lbs ?? 0) > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="fade-in w-full max-w-3xl rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Lote #{index + 1}
              {lot.lot_code && <span className="ml-2 font-mono text-base text-slate-500">· {lot.lot_code}</span>}
            </h2>
            <p className="text-xs text-slate-500">Datos completos del lote</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-4 px-6 py-5 sm:grid-cols-2">
          <Field label="Código de lote" required>
            <input
              type="text" required
              value={lot.lot_code ?? ''}
              onChange={(e) => set('lot_code', e.target.value)}
              placeholder="Ej. 1233"
              className={INPUT}
              autoFocus
            />
          </Field>

          <Field label="Lote cliente">
            <input
              type="text"
              value={lot.client_lot_code ?? ''}
              onChange={(e) => set('client_lot_code', e.target.value || null)}
              className={INPUT}
            />
          </Field>

          <CatalogSelect
            catalog="lot-categories"
            label="Categoría"
            value={lot.lot_category_id}
            onChange={(id) => set('lot_category_id', id)}
          />

          <Field label="Tipo de producto" required>
            <div className="flex gap-2">
              {(['ENTERO', 'COLA'] as ProductType[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set('product_type', p)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
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
            onChange={(id) => set('supplier_id', id ?? undefined)}
          />

          <CatalogAutocomplete
            catalog="origins"
            label="Procedencia"
            value={lot.origin_id}
            onChange={(id) => set('origin_id', id)}
          />

          <CatalogAutocomplete
            catalog="ponds"
            label="Piscina (PSC)"
            value={lot.pond_id}
            onChange={(id) => set('pond_id', id)}
            createExtra={{
              supplier_id: lot.supplier_id,
              origin_id: lot.origin_id,
            }}
          />

          <CatalogSelect
            catalog="chemicals"
            label="Producto químico"
            value={lot.chemical_id}
            onChange={(id) => set('chemical_id', id)}
          />

          <Field label="Libras recibidas" required>
            <input
              type="number" step="0.01" required
              value={lot.received_lbs ?? ''}
              onChange={(e) =>
                set('received_lbs', e.target.value ? Number(e.target.value) : null)
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
                  set('boxes_count', e.target.value ? Number(e.target.value) : null)
                }
                className={INPUT}
              />
            </Field>
            <Field label="Nº bines">
              <input
                type="number"
                value={lot.bins_count ?? ''}
                onChange={(e) =>
                  set('bins_count', e.target.value ? Number(e.target.value) : null)
                }
                className={INPUT}
              />
            </Field>
          </div>

          <Field label="Fecha de pesca">
            <input
              type="date"
              value={lot.fishing_date ?? ''}
              onChange={(e) => set('fishing_date', e.target.value || null)}
              className={INPUT}
            />
          </Field>

          <div className="sm:col-span-2">
            <CatalogMultiSelect
              catalog="treaters"
              label="Tratadores"
              value={lot.treater_ids ?? []}
              onChange={(ids) => set('treater_ids', ids)}
              placeholder="Buscar tratador o añadir nuevo…"
              pinTopMatching={(extra) => extra.is_proveedor === true}
            />
          </div>

          <Field label="Calidad a primera vista (opcional)">
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
              <StarRating
                value={lot.quality_visual ?? 0}
                onChange={(v) => set('quality_visual', v)}
                size={20}
              />
              <span className="ml-2 text-xs text-slate-500">
                {lot.quality_visual ? `${lot.quality_visual}/5` : 'Sin calificar'}
              </span>
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Observaciones">
              <textarea
                rows={2}
                value={lot.observations ?? ''}
                onChange={(e) => set('observations', e.target.value || null)}
                className={INPUT}
              />
            </Field>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-500">
            <span className="text-rose-500">*</span> campos obligatorios
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => canSave && onSave(lot)}
              disabled={!canSave}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              <Save className="h-4 w-4" />
              Guardar lote
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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

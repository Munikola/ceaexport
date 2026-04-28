import type { ReceptionCreate } from '../../types/domain'
import CatalogSelect from '../../components/CatalogSelect'
import CatalogAutocomplete from '../../components/CatalogAutocomplete'

interface Props {
  value: Partial<ReceptionCreate>
  onChange: (v: Partial<ReceptionCreate>) => void
}

export default function Step1Camion({ value, onChange }: Props) {
  const set = <K extends keyof ReceptionCreate>(k: K, v: ReceptionCreate[K] | null) =>
    onChange({ ...value, [k]: v })

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Datos del camión</h2>
        <p className="text-sm text-slate-500">Identificación de la unidad logística que llega al patio.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        <CatalogSelect
          catalog="plants"
          label="Planta"
          required
          value={value.plant_id}
          onChange={(id) => set('plant_id', id)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de llegada" required>
            <input
              type="date"
              required
              value={value.reception_date ?? ''}
              onChange={(e) => set('reception_date', e.target.value)}
              className={INPUT}
            />
          </Field>
          <Field label="Hora">
            <input
              type="time"
              value={value.arrival_time ?? ''}
              onChange={(e) => set('arrival_time', e.target.value)}
              className={INPUT}
            />
          </Field>
        </div>

        <CatalogAutocomplete
          catalog="logistics-companies"
          label="Empresa logística"
          value={value.logistics_company_id}
          onChange={(id) => set('logistics_company_id', id)}
        />
        <CatalogAutocomplete
          catalog="trucks"
          label="Placa del camión"
          value={value.truck_id}
          onChange={(id) => set('truck_id', id)}
          createExtra={
            value.logistics_company_id
              ? { logistics_company_id: value.logistics_company_id }
              : undefined
          }
        />
        <CatalogAutocomplete
          catalog="drivers"
          label="Chofer"
          value={value.driver_id}
          onChange={(id) => set('driver_id', id)}
        />

        <Field label="Guía de remisión">
          <input
            type="text"
            value={value.remission_guide_number ?? ''}
            onChange={(e) => set('remission_guide_number', e.target.value || null)}
            className={INPUT}
          />
        </Field>

        <Field label="Carta de garantía">
          <input
            type="text"
            value={value.warranty_letter_number ?? ''}
            onChange={(e) => set('warranty_letter_number', e.target.value || null)}
            className={INPUT}
          />
        </Field>

        <Field label="Temperatura llegada (°C)">
          <input
            type="number"
            step="0.1"
            value={value.arrival_temperature ?? ''}
            onChange={(e) =>
              set('arrival_temperature', e.target.value ? Number(e.target.value) : null)
            }
            className={INPUT}
          />
        </Field>
      </div>

      {/* Condiciones — bloque secundario */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3">
        <CatalogSelect
          catalog="condition-levels-truck"
          label="Estado del camión"
          value={value.truck_condition_id}
          onChange={(id) => set('truck_condition_id', id)}
        />
        <CatalogSelect
          catalog="condition-levels-ice"
          label="Estado del hielo"
          value={value.ice_condition_id}
          onChange={(id) => set('ice_condition_id', id)}
        />
        <CatalogSelect
          catalog="condition-levels-hygiene"
          label="Higiene"
          value={value.hygiene_condition_id}
          onChange={(id) => set('hygiene_condition_id', id)}
        />
      </div>

      {/* Observaciones */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <Field label="Observaciones">
          <textarea
            rows={3}
            value={value.observations ?? ''}
            onChange={(e) => set('observations', e.target.value || null)}
            className={INPUT}
          />
        </Field>
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

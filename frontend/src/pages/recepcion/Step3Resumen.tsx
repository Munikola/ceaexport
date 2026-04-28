import type { LotInReceptionCreate, ReceptionCreate } from '../../types/domain'
import { useCatalog } from '../../hooks/useCatalogs'

interface Props {
  reception: Partial<ReceptionCreate>
  lots: Partial<LotInReceptionCreate>[]
}

export default function Step3Resumen({ reception, lots }: Props) {
  const plants = useCatalog('plants')
  const suppliers = useCatalog('suppliers')
  const ponds = useCatalog('ponds')
  const logistics = useCatalog('logistics-companies')
  const trucks = useCatalog('trucks')
  const drivers = useCatalog('drivers')

  const plantName = plants.data?.find((p) => p.id === reception.plant_id)?.name ?? '—'
  const logisticsName =
    logistics.data?.find((l) => l.id === reception.logistics_company_id)?.name ?? '—'
  const truckPlate = trucks.data?.find((t) => t.id === reception.truck_id)?.name ?? '—'
  const driverName = drivers.data?.find((d) => d.id === reception.driver_id)?.name ?? '—'

  const totalLbs = lots.reduce((sum, l) => sum + (Number(l.received_lbs) || 0), 0)

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Resumen</h2>
        <p className="text-sm text-slate-500">
          Revisa los datos antes de enviar a análisis.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Camión</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Item k="Planta" v={plantName} />
          <Item k="Fecha" v={reception.reception_date ?? '—'} />
          <Item k="Hora" v={reception.arrival_time ?? '—'} />
          <Item k="Logística" v={logisticsName} />
          <Item k="Placa" v={truckPlate} />
          <Item k="Chofer" v={driverName} />
          <Item k="Guía" v={reception.remission_guide_number ?? '—'} />
          <Item k="Temp. (°C)" v={reception.arrival_temperature?.toString() ?? '—'} />
        </dl>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Lotes ({lots.length})
          </h3>
          <p className="text-sm font-medium text-slate-900">
            Total: <span className="text-cea-700">{totalLbs.toLocaleString('es')} lbs</span>
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Lote</th>
                <th className="px-4 py-2 text-left">Proveedor</th>
                <th className="px-4 py-2 text-left">Piscina</th>
                <th className="px-4 py-2 text-left">Producto</th>
                <th className="px-4 py-2 text-right">Lbs</th>
                <th className="px-4 py-2 text-right">Kavetas/Bines</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map((l, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{l.lot_code ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {suppliers.data?.find((s) => s.id === l.supplier_id)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {ponds.data?.find((p) => p.id === l.pond_id)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{l.product_type ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right text-slate-900">
                    {(l.received_lbs ?? 0).toLocaleString('es')}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-500">
                    {(l.boxes_count ?? '—') + ' / ' + (l.bins_count ?? '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {reception.observations && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Observaciones</h3>
          <p className="text-sm text-slate-600">{reception.observations}</p>
        </div>
      )}
    </section>
  )
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
      <dd className="font-medium text-slate-900">{v}</dd>
    </div>
  )
}

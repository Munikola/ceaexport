import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Truck, Package, ListChecks } from 'lucide-react'
import { api } from '../../api/client'
import type { LotInReceptionCreate, ReceptionCreate, ReceptionRead } from '../../types/domain'
import Step1Camion from './Step1Camion'
import Step2Lotes from './Step2Lotes'
import Step3Resumen from './Step3Resumen'

const STEPS = [
  { key: 'camion', label: 'Camión', icon: Truck },
  { key: 'lotes', label: 'Lotes', icon: Package },
  { key: 'resumen', label: 'Resumen', icon: ListChecks },
] as const

export default function RecepcionPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<0 | 1 | 2>(0)

  // Estado del camión (paso 1)
  const today = new Date().toISOString().slice(0, 10)
  const nowTime = new Date().toTimeString().slice(0, 5)

  const [reception, setReception] = useState<Partial<ReceptionCreate>>({
    reception_date: today,
    arrival_time: nowTime,
  })

  // Lotes (paso 2)
  const [lots, setLots] = useState<Partial<LotInReceptionCreate>[]>([{}])

  const submit = useMutation({
    mutationFn: async (payload: ReceptionCreate) =>
      (await api.post<ReceptionRead>('/api/receptions', payload)).data,
  })

  const canGoToLotes = !!reception.plant_id && !!reception.reception_date
  const canSubmit =
    canGoToLotes &&
    lots.length > 0 &&
    lots.every(
      (l) =>
        !!l.lot_code && !!l.supplier_id && !!l.product_type && (l.received_lbs ?? 0) > 0,
    )

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload = {
      ...reception,
      lots: lots.map((l) => ({
        lot_code: l.lot_code!,
        supplier_id: l.supplier_id!,
        product_type: l.product_type!,
        client_lot_code: l.client_lot_code ?? null,
        lot_year: l.lot_year ?? null,
        lot_category_id: l.lot_category_id ?? null,
        origin_id: l.origin_id ?? null,
        pond_id: l.pond_id ?? null,
        fishing_date: l.fishing_date ?? null,
        chemical_id: l.chemical_id ?? null,
        treater_ids: l.treater_ids ?? [],
        observations: l.observations ?? null,
        received_lbs: l.received_lbs ?? null,
        boxes_count: l.boxes_count ?? null,
        bins_count: l.bins_count ?? null,
        delivery_index: l.delivery_index ?? 1,
      })),
    } as ReceptionCreate

    try {
      const created = await submit.mutateAsync(payload)
      navigate(`/recepcion/${created.reception_id}/exito`, {
        state: { reception: created },
      })
    } catch {
      // El error se muestra en el botón
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> Inicio
          </button>
          <h1 className="text-base font-semibold">Nueva recepción</h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const done = i < step
            const current = i === step
            return (
              <div key={s.key} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => i <= step && setStep(i as 0 | 1 | 2)}
                  disabled={i > step}
                  className={`flex items-center gap-2 ${current ? 'text-cea-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      current
                        ? 'bg-cea-700 text-white'
                        : done
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200'
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="hidden text-sm font-medium sm:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 flex-1 ${i < step ? 'bg-emerald-300' : 'bg-slate-200'}`}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {step === 0 && <Step1Camion value={reception} onChange={setReception} />}
        {step === 1 && <Step2Lotes lots={lots} onChange={setLots} />}
        {step === 2 && <Step3Resumen reception={reception} lots={lots} />}
      </main>

      {/* Footer con botones */}
      <footer className="sticky bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1) : s))}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>

          {submit.isError && (
            <p className="flex-1 text-center text-xs text-red-600">
              {(submit.error as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
                'Error al guardar'}
            </p>
          )}

          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s < 2 ? ((s + 1) as 1 | 2) : s))}
              disabled={(step === 0 && !canGoToLotes) || (step === 1 && !canSubmit)}
              className="flex items-center gap-1 rounded-xl bg-cea-700 px-4 py-2 text-sm font-medium text-white hover:bg-cea-800 disabled:bg-slate-300"
            >
              Siguiente <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submit.isPending}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {submit.isPending ? 'Guardando…' : 'Enviar a análisis'}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}

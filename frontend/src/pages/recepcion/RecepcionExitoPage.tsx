import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Home, Plus } from 'lucide-react'
import type { ReceptionRead } from '../../types/domain'

export default function RecepcionExitoPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const state = useLocation().state as { reception?: ReceptionRead } | null
  const reception = state?.reception

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-cea-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
        <h1 className="text-xl font-semibold text-slate-900">Recepción guardada</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recepción #{reception?.reception_id ?? id} con {reception?.reception_lots.length ?? '?'} lote(s).
          Los lotes están en la bandeja de análisis pendientes.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => navigate('/recepcion')}
            className="flex items-center justify-center gap-1 rounded-xl bg-cea-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-cea-800"
          >
            <Plus className="h-4 w-4" /> Nueva recepción
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Home className="h-4 w-4" /> Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}

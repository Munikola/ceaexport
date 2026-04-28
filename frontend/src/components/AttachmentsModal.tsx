import { X } from 'lucide-react'
import AttachmentsSection from './AttachmentsSection'

interface Props {
  lotId: number
  analysisId?: number | null
  onClose: () => void
}

export default function AttachmentsModal({ lotId, analysisId, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-xl"
      >
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-10 rounded-lg bg-white p-2 text-slate-500 shadow-md ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-700"
          title="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Cuerpo con scroll */}
        <div className="overflow-y-auto p-6">
          <AttachmentsSection
            lotId={lotId}
            analysisId={analysisId ?? undefined}
            defaultTypeCode="foto_muestra"
          />
        </div>
      </div>
    </div>
  )
}

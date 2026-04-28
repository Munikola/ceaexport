import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Image as ImageIcon, Video, X } from 'lucide-react'
import { api } from '../api/client'
import type { AttachmentRead } from '../types/domain'

interface Props {
  lotId: number
  lotCode: string
  onClose: () => void
}

export default function LotPhotosModal({ lotId, lotCode, onClose }: Props) {
  const [preview, setPreview] = useState<AttachmentRead | null>(null)

  const q = useQuery({
    queryKey: ['attachments', 'lot', lotId],
    queryFn: async () =>
      (await api.get<AttachmentRead[]>(`/api/attachments?lot_id=${lotId}`)).data,
  })

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cea-100 p-2 ring-1 ring-cea-200">
              <ImageIcon className="h-4 w-4 text-cea-700" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Fotos del lote {lotCode}
              </h2>
              <p className="text-xs text-slate-500">
                {q.data?.length ?? 0} archivo(s) — click para ampliar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {q.isLoading && <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>}
          {q.data && q.data.length === 0 && (
            <p className="py-8 text-center text-sm italic text-slate-500">
              Este lote no tiene archivos.
            </p>
          )}
          {q.data && q.data.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {q.data.map((a) => (
                <Thumb key={a.attachment_id} a={a} onClick={() => setPreview(a)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {preview && <Lightbox a={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function Thumb({ a, onClick }: { a: AttachmentRead; onClick: () => void }) {
  const isImage = (a.mime_type ?? '').startsWith('image/')
  const isVideo = (a.mime_type ?? '').startsWith('video/')

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden">
        {isImage ? (
          <img
            src={a.file_url}
            alt={a.file_name ?? ''}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : isVideo ? (
          <div className="flex h-full w-full items-center justify-center bg-slate-200">
            <Video className="h-10 w-10 text-slate-500" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100">
            <FileText className="h-10 w-10 text-slate-500" />
          </div>
        )}
      </div>
      <div className="truncate px-2 py-1.5 text-left text-[10px] text-slate-600">
        {a.file_name ?? '—'}
      </div>
    </button>
  )
}

function Lightbox({ a, onClose }: { a: AttachmentRead; onClose: () => void }) {
  const isImage = (a.mime_type ?? '').startsWith('image/')
  const isVideo = (a.mime_type ?? '').startsWith('video/')

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full">
        {isImage ? (
          <img
            src={a.file_url}
            alt={a.file_name ?? ''}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        ) : isVideo ? (
          <video src={a.file_url} controls className="max-h-[85vh] max-w-[90vw] rounded-lg" />
        ) : (
          <a
            href={a.file_url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            Abrir {a.file_name ?? 'archivo'}
          </a>
        )}
      </div>
    </div>
  )
}

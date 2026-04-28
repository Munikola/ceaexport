import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Image as ImageIcon, Trash2, Upload, X, Video, FileText } from 'lucide-react'
import { api } from '../api/client'
import type { AttachmentRead } from '../types/domain'

interface Props {
  /** Filtra/asocia por análisis. Si se omite, usa lot_id. */
  analysisId?: number | null
  lotId: number
  /** Tipo de attachment por defecto al subir (foto_muestra, foto_camion, …). */
  defaultTypeCode?: string
  title?: string
}

function fileUrl(url: string) {
  // En dev, vite hace proxy de /uploads → backend. En prod, mismo origen.
  return url
}

export default function AttachmentsSection({
  analysisId,
  lotId,
  defaultTypeCode = 'foto_muestra',
  title = 'Fotos y archivos',
}: Props) {
  const qc = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<AttachmentRead | null>(null)

  // Si tenemos analysis_id, listamos por análisis. Si no, por lote.
  const queryKey = analysisId
    ? ['attachments', 'analysis', analysisId]
    : ['attachments', 'lot', lotId]
  const queryUrl = analysisId
    ? `/api/attachments?analysis_id=${analysisId}`
    : `/api/attachments?lot_id=${lotId}`

  const list = useQuery({
    queryKey,
    queryFn: async () => (await api.get<AttachmentRead[]>(queryUrl)).data,
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('lot_id', String(lotId))
      if (analysisId) fd.append('analysis_id', String(analysisId))
      fd.append('type_code', defaultTypeCode)
      const res = await api.post<AttachmentRead>('/api/attachments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return res.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const remove = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/attachments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  const onFiles = async (files: FileList | null) => {
    if (!files) return
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync(f)
      } catch {
        /* el error se muestra abajo */
      }
    }
  }

  const items = list.data ?? []

  return (
    <section
      id="fotos"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5"
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-cea-100 p-2 ring-1 ring-cea-200">
            <ImageIcon className="h-4 w-4 text-cea-700" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              {title}
            </h2>
            <p className="mt-0.5 text-xs font-normal text-slate-500">
              {items.length === 0
                ? 'Sin archivos. Arrastra o pulsa el botón para subir.'
                : `${items.length} archivo(s) — click en una miniatura para ampliar.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-cea-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cea-800 disabled:bg-slate-300"
        >
          <Upload className="h-4 w-4" />
          {upload.isPending ? 'Subiendo…' : 'Añadir'}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </header>

      {upload.isError && (
        <p className="border-b border-red-200 bg-red-50 px-6 py-2 text-xs text-red-700">
          {(upload.error as AxiosError<{ detail?: string }>)?.response?.data?.detail ??
            'Error al subir el archivo'}
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          onFiles(e.dataTransfer.files)
        }}
        className={`p-6 transition ${dragOver ? 'bg-cea-50' : ''}`}
      >
        {items.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 text-sm text-slate-500 transition hover:border-cea-400 hover:bg-cea-50/40"
          >
            <Upload className="mb-2 h-6 w-6 text-slate-400" />
            <span className="font-medium">Arrastra fotos o videos aquí</span>
            <span className="text-xs text-slate-400">o pulsa para seleccionarlos</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((a) => (
              <Thumb
                key={a.attachment_id}
                a={a}
                onClick={() => setPreview(a)}
                onDelete={() => {
                  if (confirm('¿Borrar este archivo?')) remove.mutate(a.attachment_id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {preview && <Lightbox a={preview} onClose={() => setPreview(null)} />}
    </section>
  )
}

function Thumb({
  a,
  onClick,
  onDelete,
}: {
  a: AttachmentRead
  onClick: () => void
  onDelete: () => void
}) {
  const isImage = (a.mime_type ?? '').startsWith('image/')
  const isVideo = (a.mime_type ?? '').startsWith('video/')
  const url = fileUrl(a.file_url)

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-sm">
      <button
        type="button"
        onClick={onClick}
        className="block aspect-square w-full overflow-hidden"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
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
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        <div className="truncate font-medium">{a.file_name ?? '—'}</div>
        {a.uploaded_by_name && (
          <div className="text-white/80">{a.uploaded_by_name}</div>
        )}
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        title="Borrar"
        className="absolute right-1 top-1 rounded-md bg-white/80 p-1 text-red-600 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function Lightbox({ a, onClose }: { a: AttachmentRead; onClose: () => void }) {
  const isImage = (a.mime_type ?? '').startsWith('image/')
  const isVideo = (a.mime_type ?? '').startsWith('video/')
  const url = fileUrl(a.file_url)

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
      <div className="max-h-full max-w-full" onClick={(e) => e.stopPropagation()}>
        {isImage ? (
          <img
            src={url}
            alt={a.file_name ?? ''}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
        ) : isVideo ? (
          <video src={url} controls className="max-h-[85vh] max-w-[90vw] rounded-lg" />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            Abrir {a.file_name ?? 'archivo'}
          </a>
        )}
        <div className="mt-2 text-center text-xs text-white/80">
          {a.file_name}
          {a.comment && <span className="ml-2 italic">— {a.comment}</span>}
        </div>
      </div>
    </div>
  )
}

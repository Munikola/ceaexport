import { useState } from 'react'
import { Calendar } from 'lucide-react'

interface Props {
  startDate: string
  endDate: string
  onChange: (start: string, end: string) => void
}

const PRESETS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '1 año', days: 365 },
]

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function DateRangePicker({ startDate, endDate, onChange }: Props) {
  const [open, setOpen] = useState(false)

  const applyPreset = (days: number) => {
    onChange(isoDaysAgo(days), isoToday())
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-slate-400"
      >
        <Calendar className="h-4 w-4 text-slate-500" />
        <span className="text-slate-700">
          {startDate} → {endDate}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Rangos rápidos
            </p>
            <div className="mb-3 flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => applyPreset(p.days)}
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs hover:border-cea-400 hover:bg-cea-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-slate-600">
                Desde
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => onChange(e.target.value, endDate)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="block text-xs text-slate-600">
                Hasta
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => onChange(startDate, e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

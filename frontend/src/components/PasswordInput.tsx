import { useState } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'

interface Rule {
  label: string
  test: (v: string) => boolean
}

const RULES: Rule[] = [
  { label: 'Mínimo 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Al menos 1 mayúscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Al menos 1 minúscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Al menos 2 números', test: (v) => (v.match(/[0-9]/g) ?? []).length >= 2 },
  { label: 'Al menos 1 carácter especial', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export function isPasswordStrong(value: string): boolean {
  return RULES.every((r) => r.test(value))
}

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  label?: string
  showRules?: boolean
  autoFocus?: boolean
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = 'Contraseña',
  label,
  showRules = false,
  autoFocus,
}: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 pr-10 text-sm outline-none transition focus:border-cea-500 focus:ring-2 focus:ring-cea-500/20"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {showRules && (
        <ul className="mt-2 space-y-1 text-xs">
          {RULES.map((r) => {
            const ok = r.test(value)
            return (
              <li
                key={r.label}
                className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                {r.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

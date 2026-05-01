import { useNavigate } from 'react-router-dom'
import {
  Truck,
  ClipboardList,
  Search,
  BarChart3,
  FlaskConical,
  Settings,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Tile {
  icon: typeof Truck
  label: string
  description: string
  color: string
  to: string
  roles?: string[]
}

const TILES: Tile[] = [
  {
    icon: Truck,
    label: 'Nueva recepción',
    description: 'Registrar la llegada de un camión y sus lotes',
    color: 'bg-cea-600',
    to: '/recepcion',
    roles: ['admin', 'recepcion'],
  },
  {
    icon: ClipboardList,
    label: 'Muestras',
    description: 'Bandeja de lotes pendientes y análisis en curso',
    color: 'bg-emerald-600',
    to: '/analisis',
    roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'],
  },
  {
    icon: FlaskConical,
    label: 'Histogramas',
    description: 'Clasificación por gramaje (R-CC-034)',
    color: 'bg-purple-600',
    to: '/histogramas',
    roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'],
  },
  { icon: Search, label: 'Buscar lote', description: 'Localizar un lote por código', color: 'bg-slate-600', to: '/buscar' },
  {
    icon: BarChart3,
    label: 'Dashboard',
    description: 'KPIs y tendencias',
    color: 'bg-amber-600',
    to: '/dashboard',
    roles: ['admin', 'jefe_calidad', 'consulta'],
  },
  {
    icon: Settings,
    label: 'Administración',
    description: 'Usuarios e invitaciones',
    color: 'bg-rose-600',
    to: '/admin/users',
    roles: ['admin'],
  },
]

export default function HomePage() {
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()

  const visibleTiles = TILES.filter((t) => !t.roles || hasRole(...t.roles))

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Hola, {user?.full_name?.split(' ')[0]}
        </h2>
        <p className="text-sm text-slate-500">
          Rol: {user?.role?.role_name ?? '—'} · Atajos disponibles según tu rol.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTiles.map(({ icon: Icon, label, description, color, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-cea-300 hover:shadow-md"
          >
            <div className={`shrink-0 rounded-xl ${color} p-3 text-white`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-medium text-slate-900">{label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-slate-400">
        v0.1.0 · CEA EXPORT — Control de calidad de materia prima
      </p>
    </main>
  )
}

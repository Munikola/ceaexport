import { useNavigate } from 'react-router-dom'
import {
  Truck,
  ClipboardList,
  Search,
  BarChart3,
  FlaskConical,
  Settings,
  LogOut,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Tile {
  icon: typeof Truck
  label: string
  color: string
  to: string
  roles?: string[]
}

const TILES: Tile[] = [
  { icon: Truck, label: 'Nueva recepción', color: 'bg-cea-600', to: '/recepcion', roles: ['admin', 'recepcion'] },
  { icon: ClipboardList, label: 'Muestras de lotes', color: 'bg-emerald-600', to: '/analisis', roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'] },
  { icon: Search, label: 'Buscar lote', color: 'bg-slate-600', to: '/buscar' },
  { icon: FlaskConical, label: 'Histogramas', color: 'bg-purple-600', to: '/histogramas', roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'] },
  { icon: BarChart3, label: 'Dashboard', color: 'bg-amber-600', to: '/dashboard', roles: ['admin', 'jefe_calidad', 'consulta'] },
  { icon: Settings, label: 'Administración', color: 'bg-rose-600', to: '/admin/users', roles: ['admin'] },
]

export default function HomePage() {
  const { user, hasRole, logout } = useAuth()
  const navigate = useNavigate()

  const visibleTiles = TILES.filter((t) => !t.roles || hasRole(...t.roles))

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-cea-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/10 p-2">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">CEA EXPORT</h1>
              <p className="text-xs text-cea-200">Control de calidad — materia prima</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/perfil')}
              className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden text-xs sm:inline">{user?.full_name}</span>
            </button>
            <button
              onClick={() => {
                logout()
                navigate('/login')
              }}
              className="rounded-lg p-1.5 text-cea-200 hover:bg-white/10 hover:text-white"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">Inicio</h2>
          <p className="text-sm text-slate-500">
            Hola, {user?.full_name?.split(' ')[0]}. Rol: {user?.role?.role_name ?? '—'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTiles.map(({ icon: Icon, label, color, to }) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-cea-300 hover:shadow-md"
            >
              <div className={`rounded-xl ${color} p-3 text-white`}>
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-base font-medium text-slate-900">{label}</span>
            </button>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-slate-400">
          v0.1.0 · esqueleto inicial · pantallas operativas pendientes
        </p>
      </main>
    </div>
  )
}

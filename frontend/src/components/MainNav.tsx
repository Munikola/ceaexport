import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Truck,
  ClipboardList,
  Search,
  BarChart3,
  FlaskConical,
  Settings,
  LogOut,
  User as UserIcon,
  Home,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface NavItem {
  icon: typeof Home
  label: string
  to: string
  /** Match exacto (para Home) o por prefijo */
  match?: 'exact' | 'prefix'
  roles?: string[]
}

const ITEMS: NavItem[] = [
  { icon: Home, label: 'Inicio', to: '/', match: 'exact' },
  { icon: Truck, label: 'Recepción', to: '/recepcion', roles: ['admin', 'recepcion'] },
  { icon: ClipboardList, label: 'Muestras', to: '/analisis', roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'] },
  { icon: FlaskConical, label: 'Histogramas', to: '/histogramas', roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'] },
  { icon: Search, label: 'Buscar', to: '/buscar' },
  { icon: BarChart3, label: 'Dashboard', to: '/dashboard', roles: ['admin', 'jefe_calidad', 'consulta'] },
  { icon: Settings, label: 'Admin', to: '/admin/users', roles: ['admin'] },
]

export default function MainNav() {
  const { user, hasRole, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const visibleItems = ITEMS.filter((it) => !it.roles || hasRole(...it.roles))

  const isActive = (it: NavItem) => {
    if (it.match === 'exact') return pathname === it.to
    return pathname === it.to || pathname.startsWith(it.to + '/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-cea-800 bg-cea-900 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-4">
        {/* Logo + nombre */}
        <Link to="/" className="flex shrink-0 items-center gap-2 pr-2">
          <div className="rounded-lg bg-white/10 p-1.5">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold leading-tight tracking-tight">CEA EXPORT</p>
            <p className="text-[10px] leading-tight text-cea-200">Control de calidad</p>
          </div>
        </Link>

        {/* Separador */}
        <div className="h-6 w-px bg-white/15" />

        {/* Navegación principal — scroll horizontal en móvil */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
          {visibleItems.map((it) => {
            const Icon = it.icon
            const active = isActive(it)
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-cea-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{it.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Usuario y logout */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => navigate('/perfil')}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/20"
            title={user?.full_name ?? ''}
          >
            <UserIcon className="h-4 w-4" />
            <span className="hidden max-w-[120px] truncate sm:inline">
              {user?.full_name?.split(' ')[0]}
            </span>
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
  )
}

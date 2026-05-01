import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Truck,
  ClipboardList,
  BarChart3,
  FlaskConical,
  Settings,
  Bell,
  LogOut,
  User as UserIcon,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ceaLogo from '../assets/cea-logo.jpeg'

interface NavItem {
  icon: typeof Truck
  label: string
  to: string
  match?: 'exact' | 'prefix'
  roles?: string[]
}

// Sin "Inicio": el logo a la izquierda ya cumple esa función.
// Sin "Buscar": pantalla aún no implementada — se reactivará cuando esté.
const ITEMS: NavItem[] = [
  { icon: Truck, label: 'Recepción', to: '/recepcion', roles: ['admin', 'recepcion'] },
  { icon: ClipboardList, label: 'Muestras', to: '/analisis', roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'] },
  { icon: FlaskConical, label: 'Histogramas', to: '/histogramas', roles: ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad'] },
  { icon: BarChart3, label: 'Dashboard', to: '/dashboard', roles: ['admin', 'jefe_calidad', 'consulta'] },
  { icon: Bell, label: 'Alertas', to: '/admin/alertas', roles: ['admin'] },
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
    <header className="sticky top-0 z-30 bg-cea-900 text-white shadow-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-3 sm:px-5">
        {/* Logo CEA — fondo blanco para que destaque sobre el navy */}
        <Link
          to="/"
          className="flex shrink-0 items-center gap-3 transition hover:opacity-90"
          title="Inicio"
        >
          <div className="rounded-xl bg-white p-1 shadow-md ring-1 ring-white/20">
            <img
              src={ceaLogo}
              alt="CEA EXPORT"
              className="h-9 w-9 rounded-lg object-cover"
            />
          </div>
          <div className="hidden xl:block leading-tight">
            <p className="text-sm font-bold tracking-wide">CEA EXPORT</p>
            <p className="text-[10px] uppercase tracking-wider text-cea-200">
              Control de calidad
            </p>
          </div>
        </Link>

        {/* Separador vertical sutil */}
        <div className="hidden h-8 w-px bg-white/15 sm:block" />

        {/* Navegación principal */}
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
          {visibleItems.map((it) => {
            const Icon = it.icon
            const active = isActive(it)
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`group relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-cea-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-cea-200 group-hover:text-white'}`} />
                <span className="whitespace-nowrap">{it.label}</span>
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-amber-400" />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Usuario */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => navigate('/perfil')}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            title={user?.full_name ?? 'Perfil'}
          >
            <UserIcon className="h-4 w-4" />
            <span className="hidden max-w-[140px] truncate sm:inline">
              {user?.full_name?.split(' ')[0]}
            </span>
          </button>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded-lg p-2 text-cea-200 transition hover:bg-white/10 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

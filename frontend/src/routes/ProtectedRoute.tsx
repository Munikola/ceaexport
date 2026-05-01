import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props {
  /** Si se pasa, se renderiza el children. Si no, se renderiza un <Outlet/>
   *  para usar la ruta como wrapper de rutas anidadas. */
  children?: React.ReactNode
  /** Si se especifica, solo se permite a usuarios con uno de esos roles. */
  roles?: string[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, loading, hasRole } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Cargando…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          <p className="text-sm font-medium text-slate-900">Acceso denegado</p>
          <p className="mt-1 text-xs text-slate-500">
            Tu rol no tiene permisos para esta sección.
          </p>
        </div>
      </div>
    )
  }

  return <>{children ?? <Outlet />}</>
}

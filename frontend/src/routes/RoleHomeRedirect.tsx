import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * Componente que sustituye a la home: redirige a la sección principal
 * de cada rol. Sin pantalla intermedia con tiles.
 */
export default function RoleHomeRedirect() {
  const { user, hasRole } = useAuth()

  // Recepción pura → directo a registrar camiones
  if (hasRole('recepcion') && !hasRole('admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad')) {
    return <Navigate to="/recepcion" replace />
  }

  // Roles del laboratorio y admin → bandeja de muestras (donde está la chicha)
  if (hasRole('admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad')) {
    return <Navigate to="/analisis" replace />
  }

  // Consulta → muestras también (mientras no haya dashboard real)
  if (hasRole('consulta')) {
    return <Navigate to="/analisis" replace />
  }

  // Cualquier otro caso (rol vacío, p.ej.) → al perfil para que al menos
  // pueda editar su contraseña.
  return <Navigate to={user ? '/perfil' : '/login'} replace />
}

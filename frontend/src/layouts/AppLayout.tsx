import { Outlet } from 'react-router-dom'
import MainNav from '../components/MainNav'

/**
 * Layout para todas las páginas autenticadas: barra de navegación arriba
 * + el contenido de la ruta concreta debajo.
 */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <MainNav />
      <Outlet />
    </div>
  )
}

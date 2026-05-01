import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import RoleHomeRedirect from './routes/RoleHomeRedirect'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import AcceptInvitation from './pages/public/AcceptInvitation'
import ResetPassword from './pages/public/ResetPassword'
import ProfilePage from './pages/ProfilePage'
import UsersPage from './pages/admin/UsersPage'
import RecepcionPage from './pages/recepcion/RecepcionPage'
import BandejaAnalisisPage from './pages/analisis/BandejaAnalisisPage'
import AnalisisFichaPage from './pages/analisis/AnalisisFichaPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import HistogramasPage from './pages/histogramas/HistogramasPage'

const RECEPCION_ROLES = ['admin', 'recepcion']
const ANALISIS_ROLES = ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad']
const DASHBOARD_ROLES = ['admin', 'jefe_calidad', 'consulta']

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Públicas (sin layout, sin TopNav) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invitacion/:token" element={<AcceptInvitation />} />
        <Route path="/reset/:token" element={<ResetPassword />} />

        {/* Privadas — todas envueltas en AppLayout (TopNav arriba en una fila) */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<RoleHomeRedirect />} />
          <Route path="/perfil" element={<ProfilePage />} />

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin/users" element={<UsersPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={RECEPCION_ROLES} />}>
            <Route path="/recepcion" element={<RecepcionPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={ANALISIS_ROLES} />}>
            <Route path="/analisis" element={<BandejaAnalisisPage />} />
            <Route path="/analisis/lote/:lotId" element={<AnalisisFichaPage />} />
            <Route path="/analisis/:analysisId" element={<AnalisisFichaPage />} />
            <Route path="/histogramas" element={<HistogramasPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={DASHBOARD_ROLES} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import HomePage from './pages/HomePage'
import LoginPage from './pages/auth/LoginPage'
import AcceptInvitation from './pages/public/AcceptInvitation'
import ResetPassword from './pages/public/ResetPassword'
import ProfilePage from './pages/ProfilePage'
import UsersPage from './pages/admin/UsersPage'
import RecepcionPage from './pages/recepcion/RecepcionPage'
import BandejaAnalisisPage from './pages/analisis/BandejaAnalisisPage'
import AnalisisFichaPage from './pages/analisis/AnalisisFichaPage'

const RECEPCION_ROLES = ['admin', 'recepcion']
const ANALISIS_ROLES = ['admin', 'analista_lab', 'supervisor_calidad', 'jefe_calidad']

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invitacion/:token" element={<AcceptInvitation />} />
        <Route path="/reset/:token" element={<ResetPassword />} />

        {/* Protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute roles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recepcion"
          element={
            <ProtectedRoute roles={RECEPCION_ROLES}>
              <RecepcionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analisis"
          element={
            <ProtectedRoute roles={ANALISIS_ROLES}>
              <BandejaAnalisisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analisis/lote/:lotId"
          element={
            <ProtectedRoute roles={ANALISIS_ROLES}>
              <AnalisisFichaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analisis/:analysisId"
          element={
            <ProtectedRoute roles={ANALISIS_ROLES}>
              <AnalisisFichaPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

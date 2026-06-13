import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { homePathFor, isAdmin, isPatron } from './auth/roles'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/AccountPage'
import { DashboardPage } from './pages/DashboardPage'
import { DailyPage } from './pages/DailyPage'
import { LoginPage } from './pages/LoginPage'
import { TenantsPage } from './pages/admin/TenantsPage'
import { ArticlesPage } from './pages/patron/ArticlesPage'
import { EtablissementsPage } from './pages/patron/EtablissementsPage'
import { EmployeePermissionsPage } from './pages/patron/EmployeePermissionsPage'
import { EmployeesPage } from './pages/patron/EmployeesPage'
import { MaterialsPage } from './pages/patron/MaterialsPage'
import { RecipeEditorPage } from './pages/patron/RecipeEditorPage'

function HomeRedirect() {
  const { me, loading } = useAuth()
  if (loading) return <div className="center muted">Chargement…</div>
  if (!me) return <Navigate to="/login" replace />
  return <Navigate to={homePathFor(me)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allow={isPatron}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saisie"
          element={
            <ProtectedRoute allow={(me) => me.type === 'USER'}>
              <DailyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tenants"
          element={
            <ProtectedRoute allow={isAdmin}>
              <TenantsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/etablissements"
          element={
            <ProtectedRoute allow={isPatron}>
              <EtablissementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute allow={isPatron}>
              <EmployeesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees/:id/permissions"
          element={
            <ProtectedRoute allow={isPatron}>
              <EmployeePermissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/articles"
          element={
            <ProtectedRoute allow={isPatron}>
              <ArticlesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/articles/:id/recipe"
          element={
            <ProtectedRoute allow={isPatron}>
              <RecipeEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/materials"
          element={
            <ProtectedRoute allow={isPatron}>
              <MaterialsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/mon-compte" element={<AccountPage />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}

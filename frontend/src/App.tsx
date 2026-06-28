import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { homePathFor, isAdmin, isPatron } from './auth/roles'
import { Layout } from './components/Layout'
import { AccountPage } from './pages/AccountPage'
import { DashboardPage } from './pages/DashboardPage'
import { DailyPage } from './pages/DailyPage'
import { LoginPage } from './pages/LoginPage'
import { AuditPage } from './pages/admin/AuditPage'
import { TenantsPage } from './pages/admin/TenantsPage'
import { TenantEtablissementsPage } from './pages/admin/TenantEtablissementsPage'
import { UsersAdminPage } from './pages/admin/UsersAdminPage'
import { BillingPage } from './pages/billing/BillingPage'
import { BillingSettingsPage } from './pages/billing/BillingSettingsPage'
import { ClientsPage } from './pages/billing/ClientsPage'
import { DocumentEditorPage } from './pages/billing/DocumentEditorPage'
import { AnalyticsPage } from './pages/patron/AnalyticsPage'
import { ArticlesPage } from './pages/patron/ArticlesPage'
import { CommunicationPage } from './pages/patron/CommunicationPage'
import { InvoicesPage } from './pages/patron/InvoicesPage'
import { EtablissementsPage } from './pages/patron/EtablissementsPage'
import { EmployeePermissionsPage } from './pages/patron/EmployeePermissionsPage'
import { EmployeesPage } from './pages/patron/EmployeesPage'
import { MaterialsPage } from './pages/patron/MaterialsPage'
import { RecipeEditorPage } from './pages/patron/RecipeEditorPage'
import { MenuEditorPage } from './pages/patron/MenuEditorPage'

function HomeRedirect() {
  const { me, loading } = useAuth()
  if (loading) return null
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
          path="/admin/tenants/:id/etablissements"
          element={
            <ProtectedRoute allow={isAdmin}>
              <TenantEtablissementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allow={isAdmin}>
              <UsersAdminPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <ProtectedRoute allow={isAdmin}>
              <AuditPage />
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
          path="/articles/:id/menu"
          element={
            <ProtectedRoute allow={isPatron}>
              <MenuEditorPage />
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
        <Route
          path="/factures"
          element={
            <ProtectedRoute allow={isPatron}>
              <InvoicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/communication"
          element={
            <ProtectedRoute allow={isPatron}>
              <CommunicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytique"
          element={
            <ProtectedRoute allow={isPatron}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute allow={isPatron}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute allow={isPatron}>
              <BillingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/documents/new"
          element={
            <ProtectedRoute allow={isPatron}>
              <DocumentEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/documents/:id"
          element={
            <ProtectedRoute allow={isPatron}>
              <DocumentEditorPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/settings"
          element={
            <ProtectedRoute allow={isPatron}>
              <BillingSettingsPage />
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

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '@/i18n'
import { PublicLayout } from '@/pages/PublicLayout'
import { StorefrontPage } from '@/pages/StorefrontPage'
import { OrderPage } from '@/pages/OrderPage'
import { PickupPage } from '@/pages/PickupPage'
import { AuthProvider, RequireAuth } from '@/pages/admin/auth'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { LoginPage } from '@/pages/admin/LoginPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { LockersPage } from '@/pages/admin/LockersPage'
import { OrdersPage } from '@/pages/admin/OrdersPage'
import { ProductsPage } from '@/pages/admin/ProductsPage'
import { SitesPage } from '@/pages/admin/SitesPage'
import { DevicesPage } from '@/pages/admin/DevicesPage'

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<StorefrontPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/pickup/:token" element={<PickupPage />} />
          </Route>
          <Route
            path="/admin/*"
            element={
              <AuthProvider>
                <Routes>
                  <Route path="login" element={<LoginPage />} />
                  <Route
                    element={
                      <RequireAuth>
                        <AdminLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="lockers" element={<LockersPage />} />
                    <Route path="orders" element={<OrdersPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="sites" element={<SitesPage />} />
                    <Route path="devices" element={<DevicesPage />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                  </Route>
                </Routes>
              </AuthProvider>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  )
}

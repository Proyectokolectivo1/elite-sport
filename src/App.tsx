import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
// La tienda pública va en el paquete principal: así la portada no espera cadenas de descargas.
import { StoreShell } from '@/features/tienda/components/StoreShell'
import { HomePage } from '@/features/tienda/components/HomePage'
import { CatalogoPage } from '@/features/tienda/components/CatalogoPage'
import { ProductoPage } from '@/features/tienda/components/ProductoPage'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AuthProvider } from '@/features/auth/hooks/AuthProvider'
import { RequireMayorista } from '@/features/auth/components/RequireMayorista'
import { RequireAdmin } from '@/features/auth/components/RequireAdmin'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'

const DesignSystemPage = lazy(() => import('@/features/sistema-diseno/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })))
const LoginPage = lazy(() => import('@/features/auth/components/LoginPage').then((m) => ({ default: m.LoginPage })))
const AdminLayout = lazy(() => import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const DashboardPage = lazy(() => import('@/features/dashboard/components/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ProductosPage = lazy(() => import('@/features/catalogo/components/ProductosPage').then((m) => ({ default: m.ProductosPage })))
const ProductoFormPage = lazy(() => import('@/features/catalogo/components/ProductoFormPage').then((m) => ({ default: m.ProductoFormPage })))
const InventarioPage = lazy(() => import('@/features/inventario/components/InventarioPage').then((m) => ({ default: m.InventarioPage })))
const PreciosPage = lazy(() => import('@/features/precios/components/PreciosPage').then((m) => ({ default: m.PreciosPage })))
const VentasPage = lazy(() => import('@/features/ventas/components/VentasPage').then((m) => ({ default: m.VentasPage })))
const PedidosPage = lazy(() => import('@/features/pedidos/components/PedidosPage').then((m) => ({ default: m.PedidosPage })))
const MayoristasPage = lazy(() => import('@/features/mayoristas/components/MayoristasPage').then((m) => ({ default: m.MayoristasPage })))
const ConfiguracionPage = lazy(() => import('@/features/configuracion/components/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })))
const RegistroPage = lazy(() => import('@/features/auth/components/RegistroPage').then((m) => ({ default: m.RegistroPage })))
const CuentaPage = lazy(() => import('@/features/auth/components/CuentaPage').then((m) => ({ default: m.CuentaPage })))
const MayoristaLayout = lazy(() => import('@/features/mayorista/components/MayoristaLayout').then((m) => ({ default: m.MayoristaLayout })))
const PedirPage = lazy(() => import('@/features/mayorista/components/PedirPage').then((m) => ({ default: m.PedirPage })))
const MiSeccionPage = lazy(() => import('@/features/mayorista/components/MiSeccionPage').then((m) => ({ default: m.MiSeccionPage })))
const MisPreciosPage = lazy(() => import('@/features/mayorista/components/MisPreciosPage').then((m) => ({ default: m.MisPreciosPage })))
const PedidosMayoristaPage = lazy(() => import('@/features/mayorista/components/PedidosMayoristaPage').then((m) => ({ default: m.PedidosMayoristaPage })))
const CompartirPage = lazy(() => import('@/features/mayorista/components/CompartirPage').then((m) => ({ default: m.CompartirPage })))

export default function App() {
  useConfiguracion()
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <Routes>
          {import.meta.env.DEV && <Route path="/_ds/*" element={<DesignSystemPage />} />}
          <Route
            path="/admin/login"
            element={
              <ThemeProvider>
                <LoginPage />
              </ThemeProvider>
            }
          />
          <Route path="/admin" element={<RequireAdmin />}>
            <Route element={<AdminLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="productos" element={<ProductosPage />} />
              <Route path="productos/nuevo" element={<ProductoFormPage />} />
              <Route path="productos/:id" element={<ProductoFormPage />} />
              <Route path="inventario" element={<InventarioPage />} />
              <Route path="precios" element={<PreciosPage />} />
              <Route path="ventas" element={<VentasPage />} />
              <Route path="pedidos" element={<PedidosPage />} />
              <Route path="mayoristas" element={<MayoristasPage />} />
              <Route path="configuracion" element={<ConfiguracionPage />} />
            </Route>
          </Route>
          <Route path="/registro" element={<ThemeProvider><RegistroPage /></ThemeProvider>} />
          <Route
            path="/ingresar"
            element={
              <ThemeProvider>
                <LoginPage destinoPorDefecto="/cuenta" pie={<p className="text-sm text-muted-foreground">¿Aún no tienes cuenta? <Link to="/registro" className="text-foreground underline underline-offset-4">Solicítala</Link></p>} />
              </ThemeProvider>
            }
          />
          <Route path="/cuenta" element={<ThemeProvider><CuentaPage /></ThemeProvider>} />
          <Route path="/mayorista" element={<RequireMayorista />}>
            <Route element={<MayoristaLayout />}>
              <Route index element={<PedirPage />} />
              <Route path="seccion" element={<MiSeccionPage />} />
              <Route path="precios" element={<MisPreciosPage />} />
              <Route path="pedidos" element={<PedidosMayoristaPage />} />
              <Route path="compartir" element={<CompartirPage />} />
            </Route>
          </Route>
          <Route path="/" element={<StoreShell />}>
            <Route index element={<HomePage />} />
            <Route path="catalogo" element={<CatalogoPage />} />
            <Route path="producto/:productoSlug" element={<ProductoPage />} />
          </Route>
          <Route path="/t/:slug" element={<StoreShell />}>
            <Route index element={<HomePage />} />
            <Route path="catalogo" element={<CatalogoPage />} />
            <Route path="producto/:productoSlug" element={<ProductoPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

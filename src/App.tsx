import { lazy, Suspense } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
// La tienda pública va en el paquete principal: así la portada no espera cadenas de descargas.
import { StoreShell } from '@/features/tienda/components/StoreShell'
import { HomePage } from '@/features/tienda/components/HomePage'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { AuthProvider } from '@/features/auth/hooks/AuthProvider'
import { RequireMayorista } from '@/features/auth/components/RequireMayorista'
import { RequirePanel } from '@/features/auth/components/RequireAdmin'
import { AvisoVersion } from '@/components/AvisoVersion'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'

// Catálogo y ficha van aparte de la portada y se descargan en segundo plano apenas el navegador queda libre.
const cargarCatalogo = () => import('@/features/tienda/components/CatalogoPage').then((m) => ({ default: m.CatalogoPage }))
const cargarProducto = () => import('@/features/tienda/components/ProductoPage').then((m) => ({ default: m.ProductoPage }))
const CatalogoPage = lazy(cargarCatalogo)
const ProductoPage = lazy(cargarProducto)
if (typeof window !== 'undefined') {
  const precargar = () => {
    void cargarCatalogo()
    void cargarProducto()
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(precargar, { timeout: 4000 })
  else setTimeout(precargar, 2000)
}
const DesignSystemPage = lazy(() => import('@/features/sistema-diseno/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })))
const LoginPage = lazy(() => import('@/features/auth/components/LoginPage').then((m) => ({ default: m.LoginPage })))
const AdminLayout = lazy(() => import('@/features/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const DashboardPage = lazy(() => import('@/features/dashboard/components/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ProductosPage = lazy(() => import('@/features/catalogo/components/ProductosPage').then((m) => ({ default: m.ProductosPage })))
const ProductoFormPage = lazy(() => import('@/features/catalogo/components/ProductoFormPage').then((m) => ({ default: m.ProductoFormPage })))
const InventarioPage = lazy(() => import('@/features/inventario/components/InventarioPage').then((m) => ({ default: m.InventarioPage })))
const PreciosPage = lazy(() => import('@/features/precios/components/PreciosPage').then((m) => ({ default: m.PreciosPage })))
const VentasPage = lazy(() => import('@/features/ventas/components/VentasPage').then((m) => ({ default: m.VentasPage })))
const CajaPage = lazy(() => import('@/features/caja/components/CajaPage').then((m) => ({ default: m.CajaPage })))
const DevolucionesPage = lazy(() => import('@/features/devoluciones/components/DevolucionesPage').then((m) => ({ default: m.DevolucionesPage })))
const ImportarProductosPage = lazy(() => import('@/features/catalogo/components/ImportarProductosPage').then((m) => ({ default: m.ImportarProductosPage })))
const PedidosPage = lazy(() => import('@/features/pedidos/components/PedidosPage').then((m) => ({ default: m.PedidosPage })))
const MayoristasPage = lazy(() => import('@/features/mayoristas/components/MayoristasPage').then((m) => ({ default: m.MayoristasPage })))
const ConfiguracionPage = lazy(() => import('@/features/configuracion/components/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })))
const RegistroPage = lazy(() => import('@/features/auth/components/RegistroPage').then((m) => ({ default: m.RegistroPage })))
const RecuperarPage = lazy(() => import('@/features/auth/components/RecuperarPage').then((m) => ({ default: m.RecuperarPage })))
const NuevaContrasenaPage = lazy(() => import('@/features/auth/components/NuevaContrasenaPage').then((m) => ({ default: m.NuevaContrasenaPage })))
const CuentaPage = lazy(() => import('@/features/auth/components/CuentaPage').then((m) => ({ default: m.CuentaPage })))
const MayoristaLayout = lazy(() => import('@/features/mayorista/components/MayoristaLayout').then((m) => ({ default: m.MayoristaLayout })))
const ClientesPage = lazy(() => import('@/features/mayorista/components/ClientesPage').then((m) => ({ default: m.ClientesPage })))
const PedirPage = lazy(() => import('@/features/mayorista/components/PedirPage').then((m) => ({ default: m.PedirPage })))
const MiSeccionPage = lazy(() => import('@/features/mayorista/components/MiSeccionPage').then((m) => ({ default: m.MiSeccionPage })))
const MisPreciosPage = lazy(() => import('@/features/mayorista/components/MisPreciosPage').then((m) => ({ default: m.MisPreciosPage })))
const PedidosMayoristaPage = lazy(() => import('@/features/mayorista/components/PedidosMayoristaPage').then((m) => ({ default: m.PedidosMayoristaPage })))
const CompartirPage = lazy(() => import('@/features/mayorista/components/CompartirPage').then((m) => ({ default: m.CompartirPage })))
const BodegaPage = lazy(() => import('@/features/bodega/components/BodegaPage').then((m) => ({ default: m.BodegaPage })))
const CobrosPage = lazy(() => import('@/features/bodega/components/CobrosPage').then((m) => ({ default: m.CobrosPage })))
const EquipoPage = lazy(() => import('@/features/bodega/components/EquipoPage').then((m) => ({ default: m.EquipoPage })))
const MiMercanciaPage = lazy(() => import('@/features/ventas/components/MiMercanciaPage').then((m) => ({ default: m.MiMercanciaPage })))
const VenderLocalPage = lazy(() => import('@/features/ventas/components/VenderLocalPage').then((m) => ({ default: m.VenderLocalPage })))
const cargarSector = () => import('@/features/bodega/components/SectorLayout')
const SectorLayout = lazy(() => cargarSector().then((m) => ({ default: m.SectorLayout })))
const SectorEnPoderPage = lazy(() => cargarSector().then((m) => ({ default: m.SectorEnPoderPage })))
const SectorPedirPage = lazy(() => cargarSector().then((m) => ({ default: m.SectorPedirPage })))
const SectorHistorialPage = lazy(() => cargarSector().then((m) => ({ default: m.SectorHistorialPage })))

/** Mientras baja la página: un aviso discreto en vez de una pantalla vacía. */
function Cargando() {
  return (
    <div role="status" aria-live="polite" className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
      Cargando…
    </div>
  )
}

export default function App() {
  useConfiguracion()
  return (
    <AuthProvider>
      <AvisoVersion />
      <Suspense fallback={<Cargando />}>
        <Routes>
          {import.meta.env.DEV && <Route path="/_ds/*" element={<DesignSystemPage />} />}
          {/* Un solo ingreso para todos los roles: /ingresar lleva a cada persona a su panel. Esta ruta se conserva por los enlaces guardados. */}
          <Route path="/admin/login" element={<Navigate to="/ingresar" replace />} />
          {/* Panel: admin, bodeguero y vendedor. Cada grupo de rutas exige su rol; el resto va a su inicio. */}
          <Route path="/admin" element={<RequirePanel />}>
            <Route element={<AdminLayout />}>
              <Route element={<RequirePanel roles={['admin']} />}>
                <Route index element={<DashboardPage />} />
                <Route path="productos" element={<ProductosPage />} />
                <Route path="productos/nuevo" element={<ProductoFormPage />} />
                <Route path="productos/importar" element={<ImportarProductosPage />} />
                <Route path="productos/:id" element={<ProductoFormPage />} />
                <Route path="precios" element={<PreciosPage />} />
                <Route path="ventas" element={<VentasPage />} />
                <Route path="caja" element={<CajaPage />} />
                <Route path="pedidos" element={<PedidosPage />} />
                <Route path="devoluciones" element={<DevolucionesPage />} />
                <Route path="mayoristas" element={<MayoristasPage />} />
                <Route path="cobros" element={<CobrosPage />} />
                <Route path="equipo" element={<EquipoPage />} />
                <Route path="configuracion" element={<ConfiguracionPage />} />
              </Route>
              <Route element={<RequirePanel roles={['admin', 'bodeguero']} />}>
                <Route path="inventario" element={<InventarioPage />} />
                <Route path="bodega" element={<BodegaPage vista="por_despachar" />} />
                <Route path="bodega/cierre" element={<BodegaPage vista="en_poder" />} />
                <Route path="bodega/web" element={<BodegaPage vista="web" />} />
                <Route path="bodega/historial" element={<BodegaPage vista="historial" />} />
              </Route>
              <Route element={<RequirePanel roles={['vendedor']} />}>
                <Route path="local" element={<MiMercanciaPage />} />
                <Route path="local/vender" element={<VenderLocalPage />} />
              </Route>
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
          <Route path="/recuperar" element={<ThemeProvider><RecuperarPage /></ThemeProvider>} />
          <Route path="/nueva-contrasena" element={<ThemeProvider><NuevaContrasenaPage /></ThemeProvider>} />
          <Route path="/cuenta" element={<ThemeProvider><CuentaPage /></ThemeProvider>} />
          <Route path="/mayorista" element={<RequireMayorista />}>
            <Route element={<MayoristaLayout />}>
              <Route index element={<ClientesPage />} />
              <Route path="pedir" element={<PedirPage />} />
              <Route path="seccion" element={<MiSeccionPage />} />
              <Route path="precios" element={<MisPreciosPage />} />
              <Route path="pedidos" element={<PedidosMayoristaPage />} />
              <Route path="compartir" element={<CompartirPage />} />
            </Route>
          </Route>
          <Route path="/sector" element={<RequirePanel roles={['mayorista_sector']} login="/ingresar" />}>
            <Route element={<SectorLayout />}>
              <Route index element={<SectorEnPoderPage />} />
              <Route path="pedir" element={<SectorPedirPage />} />
              <Route path="historial" element={<SectorHistorialPage />} />
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

import {
  BarChart3,
  ClipboardList,
  ClipboardCheck,
  Undo2,
  Landmark,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  PackageOpen,
  ReceiptText,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  Warehouse,
} from 'lucide-react'
import { useState } from 'react'
import { PanelLayout, type PanelNavItem } from '@/components/layout/PanelLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toast'
import { cerrarSesion } from '@/features/auth/api/auth'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import type { Rol } from '@/features/auth/roles'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { guardarSonido, sonarAviso, sonidoActivo } from '@/features/avisos/sonido'
import { useAvisos } from '@/features/avisos/useAvisos'
import { usePedidosEnVivo } from '@/features/avisos/usePedidosEnVivo'
import { useLocales } from '@/features/bodega/hooks/useBodega'

const NAV_ADMIN: PanelNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/ventas', label: 'Ventas', icon: Store },
  { to: '/admin/por-cerrar', label: 'Por cerrar', icon: ReceiptText },
  { to: '/admin/caja', label: 'Caja', icon: Landmark },
  { to: '/admin/ventas-tiendas', label: 'Por tienda', icon: BarChart3 },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/admin/devoluciones', label: 'Devoluciones', icon: Undo2 },
  { to: '/admin/bodega', label: 'Bodega', icon: Warehouse },
  { to: '/admin/cobros', label: 'Cobros', icon: Wallet },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/inventario', label: 'Inventario', icon: Truck },
  { to: '/admin/precios', label: 'Precios', icon: Tag },
  { to: '/admin/mayoristas', label: 'Mayoristas', icon: Users },
  { to: '/admin/equipo', label: 'Equipo', icon: UserCog },
  { to: '/admin/configuracion', label: 'Ajustes', icon: Settings },
]

// El bodeguero no ve precios, ventas, mayoristas ni ajustes.
const NAV_BODEGUERO: PanelNavItem[] = [
  { to: '/admin/bodega', label: 'Despachos', icon: PackageOpen, end: true },
  { to: '/admin/bodega/cierre', label: 'Cierre', icon: ClipboardCheck },
  { to: '/admin/bodega/web', label: 'Pedidos web', icon: ShoppingBag },
  { to: '/admin/bodega/historial', label: 'Historial', icon: History },
  { to: '/admin/inventario', label: 'Inventario', icon: Truck },
]

// El auxiliar solo mira la bodega para avisar al bodeguero.
const NAV_AUXILIAR: PanelNavItem[] = [
  { to: '/admin/bodega', label: 'Por despachar', icon: PackageOpen, end: true },
  { to: '/admin/bodega/cierre', label: 'En poder', icon: ClipboardCheck },
  { to: '/admin/bodega/web', label: 'Pedidos web', icon: ShoppingBag },
  { to: '/admin/bodega/historial', label: 'Historial', icon: History },
]

const NAV_VENDEDOR: PanelNavItem[] = [
  { to: '/admin/local', label: 'Mi mercancía', icon: Warehouse, end: true },
  { to: '/admin/local/vender', label: 'Vender', icon: Store },
]

const POR_ROL: Partial<Record<Rol, { nav: PanelNavItem[]; seccion: string }>> = {
  admin: { nav: NAV_ADMIN, seccion: 'Administración' },
  bodeguero: { nav: NAV_BODEGUERO, seccion: 'Bodega' },
  auxiliar_bodega: { nav: NAV_AUXILIAR, seccion: 'Auxiliar de bodega' },
  vendedor: { nav: NAV_VENDEDOR, seccion: 'Local' },
}

export function AdminLayout() {
  const { data } = useConfiguracion()
  const { perfil } = useAuth()
  const base = (perfil && POR_ROL[perfil.rol]) || { nav: [], seccion: 'Panel' }
  // El vendedor ve el nombre de su local en el panel (Local KZ).
  const { data: locales } = useLocales(perfil?.rol === 'vendedor' && !!perfil.local_id)
  const miLocal = perfil?.local_id ? locales?.find((l) => l.id === perfil.local_id)?.nombre : undefined
  const panel = miLocal ? { ...base, seccion: `Local ${miLocal}` } : base
  const { pendientes, total } = useAvisos(perfil?.rol)
  const miraBodega = perfil?.rol === 'admin' || perfil?.rol === 'bodeguero' || perfil?.rol === 'auxiliar_bodega'
  usePedidosEnVivo(!!perfil)
  const [sonido, setSonido] = useState(sonidoActivo)
  // Insignia con lo que espera atencion en cada seccion.
  const cuenta: Record<string, number> =
    perfil?.rol === 'admin'
      ? { '/admin/pedidos': pendientes.pedidos, '/admin/bodega': pendientes.bodega, '/admin/mayoristas': pendientes.mayoristas }
      : perfil?.rol === 'bodeguero' || perfil?.rol === 'auxiliar_bodega'
        ? { '/admin/bodega': pendientes.bodega, '/admin/bodega/web': pendientes.web }
        : {}
  const nav = panel.nav.map((i) => (cuenta[i.to] ? { ...i, badge: cuenta[i.to] } : i))
  return (
    <ThemeProvider>
      <Toaster />
      <PanelLayout
        nombre={data?.nombre_negocio ?? 'Elite Sport'}
        seccion={panel.seccion}
        nav={nav}
        acciones={
          <>
            {miraBodega && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={sonido ? 'Silenciar avisos' : 'Activar sonido de avisos'}
                aria-pressed={sonido}
                title={total > 0 ? `${total} por atender` : 'Sin pendientes'}
                onClick={() => {
                  const nuevo = !sonido
                  setSonido(nuevo)
                  guardarSonido(nuevo)
                  if (nuevo) sonarAviso()
                }}
              >
                {sonido ? <Volume2 /> : <VolumeX />}
              </Button>
            )}
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar sesión" onClick={() => void cerrarSesion()}>
            <LogOut />
          </Button>
          </>
        }
      />
    </ThemeProvider>
  )
}

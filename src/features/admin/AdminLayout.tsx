import {
  ClipboardList,
  ClipboardCheck,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  PackageOpen,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react'
import { PanelLayout, type PanelNavItem } from '@/components/layout/PanelLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toast'
import { cerrarSesion } from '@/features/auth/api/auth'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import type { Rol } from '@/features/auth/roles'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'

const NAV_ADMIN: PanelNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/ventas', label: 'Ventas', icon: Store },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/admin/bodega', label: 'Bodega', icon: Warehouse },
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

const NAV_VENDEDOR: PanelNavItem[] = [
  { to: '/admin/local', label: 'Mi mercancía', icon: Warehouse, end: true },
  { to: '/admin/local/vender', label: 'Vender', icon: Store },
]

const POR_ROL: Partial<Record<Rol, { nav: PanelNavItem[]; seccion: string }>> = {
  admin: { nav: NAV_ADMIN, seccion: 'Administración' },
  bodeguero: { nav: NAV_BODEGUERO, seccion: 'Bodega' },
  vendedor: { nav: NAV_VENDEDOR, seccion: 'Local' },
}

export function AdminLayout() {
  const { data } = useConfiguracion()
  const { perfil } = useAuth()
  const panel = (perfil && POR_ROL[perfil.rol]) || { nav: [], seccion: 'Panel' }
  return (
    <ThemeProvider>
      <Toaster />
      <PanelLayout
        nombre={data?.nombre_negocio ?? 'Elite Sport'}
        seccion={panel.seccion}
        nav={panel.nav}
        acciones={
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar sesión" onClick={() => void cerrarSesion()}>
            <LogOut />
          </Button>
        }
      />
    </ThemeProvider>
  )
}

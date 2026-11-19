import {
  ClipboardList,
  ClipboardCheck,
  Landmark,
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

const NAV_ADMIN: PanelNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/ventas', label: 'Ventas', icon: Store },
  { to: '/admin/caja', label: 'Caja', icon: Landmark },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
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
  const { pendientes, total } = useAvisos(perfil?.rol === 'admin' || perfil?.rol === 'bodeguero' || perfil?.rol === 'vendedor' ? perfil.rol : undefined)
  const [sonido, setSonido] = useState(sonidoActivo)
  // Insignia con lo que espera atencion en cada seccion.
  const cuenta: Record<string, number> =
    perfil?.rol === 'admin'
      ? { '/admin/pedidos': pendientes.pedidos, '/admin/bodega': pendientes.bodega, '/admin/mayoristas': pendientes.mayoristas }
      : perfil?.rol === 'bodeguero'
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
            {(perfil?.rol === 'admin' || perfil?.rol === 'bodeguero') && (
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

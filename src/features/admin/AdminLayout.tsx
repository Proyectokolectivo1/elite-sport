import { ClipboardList, LayoutDashboard, LogOut, Package, Settings, Store, Tag, Truck, Users } from 'lucide-react'
import { PanelLayout, type PanelNavItem } from '@/components/layout/PanelLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toast'
import { cerrarSesion } from '@/features/auth/api/auth'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'

const NAV: PanelNavItem[] = [
  { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/admin/ventas', label: 'Ventas', icon: Store },
  { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/inventario', label: 'Inventario', icon: Truck },
  { to: '/admin/precios', label: 'Precios', icon: Tag },
  { to: '/admin/mayoristas', label: 'Mayoristas', icon: Users },
  { to: '/admin/configuracion', label: 'Ajustes', icon: Settings },
]

export function AdminLayout() {
  const { data } = useConfiguracion()
  return (
    <ThemeProvider>
      <Toaster />
      <PanelLayout
        nombre={data?.nombre_negocio ?? 'Elite Sport'}
        seccion="Administración"
        nav={NAV}
        acciones={
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar sesión" onClick={() => void cerrarSesion()}>
            <LogOut />
          </Button>
        }
      />
    </ThemeProvider>
  )
}

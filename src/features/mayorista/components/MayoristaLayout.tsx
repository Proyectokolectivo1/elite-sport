import { LogOut, Package, Palette, Receipt, Share2, Tag } from 'lucide-react'
import { PanelLayout, type PanelNavItem } from '@/components/layout/PanelLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toast'
import { cerrarSesion } from '@/features/auth/api/auth'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { useMiTienda } from '../hooks/useMayorista'

const NAV: PanelNavItem[] = [
  { to: '/mayorista', label: 'Pedir', icon: Package, end: true },
  { to: '/mayorista/seccion', label: 'Mi sección', icon: Palette },
  { to: '/mayorista/precios', label: 'Precios', icon: Tag },
  { to: '/mayorista/pedidos', label: 'Pedidos', icon: Receipt },
  { to: '/mayorista/compartir', label: 'Compartir', icon: Share2 },
]

export function MayoristaLayout() {
  useConfiguracion()
  const { data: tienda } = useMiTienda()
  return (
    <ThemeProvider>
      <Toaster />
      <PanelLayout
        nombre={tienda?.nombre ?? 'Elite Sport'}
        logoUrl={tienda?.logo_url}
        seccion="Panel mayorista"
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

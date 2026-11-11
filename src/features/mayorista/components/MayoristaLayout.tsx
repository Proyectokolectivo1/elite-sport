import { LogOut, Package, Palette, Receipt, Share2, Tag } from 'lucide-react'
import { PanelLayout, type PanelNavItem } from '@/components/layout/PanelLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toast'
import { cerrarSesion } from '@/features/auth/api/auth'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { Link } from 'react-router-dom'
import { useMiPlazo, useMiTienda } from '../hooks/useMayorista'

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
  const { data: plazo } = useMiPlazo()
  const dias = plazo?.diasRestantes ?? null
  const aviso =
    dias !== null && dias <= 10 ? (
      <div role="status" className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <strong>{dias <= 0 ? 'Tu catálogo se bloqueará hoy.' : `Te quedan ${dias} ${dias === 1 ? 'día' : 'días'} para hacer un pedido.`}</strong>{' '}
        Si no pides a Elite Sport antes de esa fecha, tu sección y tu panel se bloquean. <Link to="/mayorista" className="underline underline-offset-4">Hacer un pedido</Link>
      </div>
    ) : null
  return (
    <ThemeProvider>
      <Toaster />
      <PanelLayout
        nombre={tienda?.nombre ?? 'Elite Sport'}
        logoUrl={tienda?.logo_url}
        seccion="Panel mayorista"
        nav={NAV}
        aviso={aviso}
        acciones={
          <Button variant="ghost" size="icon-sm" aria-label="Cerrar sesión" onClick={() => void cerrarSesion()}>
            <LogOut />
          </Button>
        }
      />
    </ThemeProvider>
  )
}

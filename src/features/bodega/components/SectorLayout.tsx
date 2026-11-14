import { History, LogOut, Package, Warehouse } from 'lucide-react'
import { PanelLayout, type PanelNavItem } from '@/components/layout/PanelLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Toaster } from '@/components/ui/toast'
import { cerrarSesion } from '@/features/auth/api/auth'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { EnPoderTabla } from './EnPoderTabla'
import { MisEntregas } from './MisEntregas'
import { PedirABodega } from './PedirABodega'

const NAV: PanelNavItem[] = [
  { to: '/sector', label: 'En mi poder', icon: Warehouse, end: true },
  { to: '/sector/pedir', label: 'Pedir', icon: Package },
  { to: '/sector/historial', label: 'Historial', icon: History },
]

/** Panel del mayorista del sector: retira pares en bodega y los liquida al cierre del día. */
export function SectorLayout() {
  useConfiguracion()
  const { perfil } = useAuth()
  return (
    <ThemeProvider>
      <Toaster />
      <PanelLayout
        nombre={perfil?.negocio || perfil?.nombre || 'Elite Sport'}
        seccion="Mayorista del sector"
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

export function SectorEnPoderPage() {
  return (
    <>
      <PageHeader title="En mi poder" description="Pares que retiraste en bodega. Al final del día se cuenta lo que regresa; el resto se liquida a tu precio de mayorista." />
      <EnPoderTabla etiquetaPrecio="a tu precio" />
      <h2 className="mt-10 mb-4 text-3xl">Pedidos abiertos</h2>
      <MisEntregas estados={['nuevo', 'entregado']} vacio="No tienes pedidos abiertos." />
    </>
  )
}

export function SectorPedirPage() {
  return (
    <>
      <PageHeader title="Pedir a bodega" description="Elige los pares que vas a llevar hoy. Bodega te los entrega y los liquidas al cierre." />
      <PedirABodega />
    </>
  )
}

export function SectorHistorialPage() {
  return (
    <>
      <PageHeader title="Historial" description="Entregas cerradas: lo vendido se cobra a tu precio de mayorista." />
      <MisEntregas estados={['liquidado', 'cancelado']} conTotal vacio="Aún no tienes entregas cerradas." />
    </>
  )
}

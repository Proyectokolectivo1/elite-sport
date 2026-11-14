import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { CurvasTab } from './CurvasTab'
import { ExistenciasTab } from './ExistenciasTab'
import { IngresoForm } from './IngresoForm'
import { MovimientosTab } from './MovimientosTab'

const TABS = [
  { id: 'existencias', label: 'Existencias' },
  { id: 'ingreso', label: 'Ingresar mercancía' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'surtidos', label: 'Surtidos de caja' },
] as const

type TabId = (typeof TABS)[number]['id']

// El bodeguero no ve el libro de movimientos ni edita los surtidos de caja.
const SOLO_ADMIN: readonly TabId[] = ['movimientos', 'surtidos']

export function InventarioPage() {
  const [params, setParams] = useSearchParams()
  const { perfil } = useAuth()
  const esAdmin = perfil?.rol === 'admin'
  const tabs = esAdmin ? [...TABS] : TABS.filter((t) => !SOLO_ADMIN.includes(t.id))
  const actual = tabs.find((t) => t.id === params.get('tab'))?.id ?? 'existencias'

  function cambiar(id: TabId) {
    setParams({ tab: id }, { replace: true })
  }

  return (
    <>
      <PageHeader title="Inventario" description="Un solo inventario para todas las ventas. Solo cambia con ingresos, ajustes, pedidos confirmados y entregas de bodega." />
      <Tabs className="mb-6" tabs={tabs} value={actual} onChange={cambiar} />
      {actual === 'existencias' && <ExistenciasTab />}
      {actual === 'ingreso' && <IngresoForm productoInicial={params.get('producto') ?? undefined} />}
      {actual === 'movimientos' && <MovimientosTab />}
      {actual === 'surtidos' && <CurvasTab />}
    </>
  )
}

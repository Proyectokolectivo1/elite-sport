import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs } from '@/components/ui/tabs'
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

export function InventarioPage() {
  const [params, setParams] = useSearchParams()
  const actual = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'existencias'

  function cambiar(id: TabId) {
    setParams({ tab: id }, { replace: true })
  }

  return (
    <>
      <PageHeader eyebrow="Inventario central" title="Inventario" description="Un solo inventario para todas las ventas. Solo cambia con ingresos, ajustes y pedidos confirmados." />
      <Tabs className="mb-6" tabs={[...TABS]} value={actual} onChange={cambiar} />
      {actual === 'existencias' && <ExistenciasTab />}
      {actual === 'ingreso' && <IngresoForm productoInicial={params.get('producto') ?? undefined} />}
      {actual === 'movimientos' && <MovimientosTab />}
      {actual === 'surtidos' && <CurvasTab />}
    </>
  )
}

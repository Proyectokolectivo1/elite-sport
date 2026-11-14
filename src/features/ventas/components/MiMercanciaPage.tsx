import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs } from '@/components/ui/tabs'
import { EnPoderTabla } from '@/features/bodega/components/EnPoderTabla'
import { MisEntregas } from '@/features/bodega/components/MisEntregas'
import { PedirABodega } from '@/features/bodega/components/PedirABodega'

type Tab = 'poder' | 'pedir' | 'entregas'

/** Vendedor del local: lo que tiene en su poder, pedir a bodega y sus entregas. */
export function MiMercanciaPage() {
  const [tab, setTab] = useState<Tab>('poder')
  return (
    <>
      <PageHeader title="Mi mercancía" description="Pide pares a bodega para vender en el local. Al cierre, el bodeguero cuenta lo vendido y lo que regresa." />
      <Tabs
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'poder', label: 'En mi poder' },
          { id: 'pedir', label: 'Pedir a bodega' },
          { id: 'entregas', label: 'Mis pedidos' },
        ]}
      />
      {tab === 'poder' && <EnPoderTabla etiquetaPrecio="a precio de venta" />}
      {tab === 'pedir' && <PedirABodega onEnviado={() => setTab('entregas')} />}
      {tab === 'entregas' && <MisEntregas vacio="Tus pedidos a bodega aparecerán aquí." />}
    </>
  )
}

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { useDetallePedido } from '@/features/pedidos/hooks/usePedidos'
import type { EstadoPedido, PedidoFila } from '@/features/pedidos/api/pedidos'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { useCancelarMiPedido, useMisPedidos } from '../hooks/useMayorista'

const ESTADOS: Record<EstadoPedido, string> = { nuevo: 'Nuevo', confirmado: 'Confirmado', entregado: 'Entregado', cancelado: 'Cancelado' }
const TONO: Record<EstadoPedido, 'signal' | 'warning' | 'success' | 'neutral'> = { nuevo: 'signal', confirmado: 'warning', entregado: 'success', cancelado: 'neutral' }
const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

function Fila({ p, puedeCancelar }: { p: PedidoFila; puedeCancelar: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const { data: lineas = [] } = useDetallePedido(abierto ? p.id : null)
  const cancelar = useCancelarMiPedido()
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  return (
    <li className="rounded-md border border-border bg-card">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
        <span>
          <strong className="tabular-nums">#{p.numero}</strong> · {p.cliente}
          <span className="block text-xs text-muted-foreground">{fecha.format(new Date(p.creadoEn))}</span>
        </span>
        <span className="flex items-center gap-3">
          <Badge variant={TONO[p.estado]}>{ESTADOS[p.estado]}</Badge>
          <span className="font-semibold tabular-nums">{fmt(p.total)}</span>
        </span>
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-border p-4 text-sm">
          <ul className="space-y-1">
            {lineas.map((l) => <li key={l.id} className="flex justify-between gap-3"><span>{l.cantidad} × {l.descripcion}</span><span className="tabular-nums">{fmt(l.cantidad * l.precio)}</span></li>)}
          </ul>
          <p className="text-muted-foreground">Teléfono: {p.telefono}{p.nota ? ` · Nota: ${p.nota}` : ''}</p>
          {puedeCancelar && p.estado === 'nuevo' && (
            <Button size="sm" variant="outline" disabled={cancelar.isPending} onClick={() => cancelar.mutate(p.id, { onSuccess: () => toast.success('Pedido cancelado'), onError: (e) => toast.error(mensajeError(e)) })}>Cancelar pedido</Button>
          )}
        </div>
      )}
    </li>
  )
}

export function PedidosMayoristaPage() {
  const { data = [], isLoading } = useMisPedidos()
  const [tab, setTab] = useState<'compras' | 'ventas'>('compras')
  const compras = data.filter((p) => p.tipo === 'mayorista')
  const ventas = data.filter((p) => p.tipo === 'lead_tienda')
  const lista = tab === 'compras' ? compras : ventas

  return (
    <>
      <PageHeader title="Pedidos" />
      <Tabs className="mb-6" value={tab} onChange={setTab} tabs={[{ id: 'compras', label: `Mis compras (${compras.length})` }, { id: 'ventas', label: `Pedidos de mi tienda (${ventas.length})` }]} />
      {tab === 'ventas' && <p className="mb-4 text-sm text-muted-foreground">Son los pedidos que tus clientes te enviaron desde tu sección. No descuentan el inventario de Elite Sport: tú los atiendes con tu propio abastecimiento.</p>}
      {isLoading ? <Skeleton className="h-40 w-full" /> : lista.length === 0 ? (
        <EmptyState title="Nada por aquí todavía" description={tab === 'compras' ? 'Tus pedidos al administrador aparecerán aquí.' : 'Cuando un cliente te escriba desde tu sección, lo verás aquí.'} />
      ) : (
        <ul className="space-y-3">{lista.map((p) => <Fila key={p.id} p={p} puedeCancelar={tab === 'compras'} />)}</ul>
      )}
    </>
  )
}

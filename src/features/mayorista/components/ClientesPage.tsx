import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import type { EstadoPedido, PedidoFila } from '@/features/pedidos/api/pedidos'
import { useDetallePedido } from '@/features/pedidos/hooks/usePedidos'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useActualizarPedidoCliente, useMisPedidos } from '../hooks/useMayorista'

const ESTADOS: Record<EstadoPedido, string> = { nuevo: 'Nuevo', confirmado: 'En proceso', entregado: 'Entregado', cancelado: 'Cancelado' }
const TONO: Record<EstadoPedido, 'signal' | 'warning' | 'success' | 'neutral'> = { nuevo: 'signal', confirmado: 'warning', entregado: 'success', cancelado: 'neutral' }
const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

type Filtro = 'nuevo' | 'confirmado' | 'entregado' | 'cancelado' | 'todos'

function Detalle({ pedido, onCerrar }: { pedido: PedidoFila; onCerrar: () => void }) {
  const { data: lineas = [], isLoading } = useDetallePedido(pedido.id)
  const actualizar = useActualizarPedidoCliente()
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const tel = pedido.telefono.replace(/\D/g, '')

  function cambiar(estado: 'confirmado' | 'entregado' | 'cancelado', mensaje: string) {
    actualizar.mutate({ id: pedido.id, estado }, { onSuccess: () => { toast.success(mensaje); onCerrar() }, onError: (e) => toast.error(mensajeError(e)) })
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="col-span-2"><dt className="eyebrow">Cliente</dt><dd className="mt-0.5 font-semibold">{pedido.cliente}</dd></div>
        {pedido.documento && <div><dt className="eyebrow">Cédula o RUC</dt><dd className="mt-0.5">{pedido.documento}</dd></div>}
        <div><dt className="eyebrow">Celular</dt><dd className="mt-0.5"><a className="underline underline-offset-4" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">{pedido.telefono}</a></dd></div>
        {pedido.correo && <div className="col-span-2"><dt className="eyebrow">Correo</dt><dd className="mt-0.5 break-all"><a className="underline underline-offset-4" href={`mailto:${pedido.correo}`}>{pedido.correo}</a></dd></div>}
        {pedido.direccion && <div className="col-span-2"><dt className="eyebrow">Dirección de entrega</dt><dd className="mt-0.5">{pedido.direccion}</dd></div>}
        <div className="col-span-2"><dt className="eyebrow">Recibido</dt><dd className="mt-0.5">{fecha.format(new Date(pedido.creadoEn))}</dd></div>
        {pedido.nota && <div className="col-span-2"><dt className="eyebrow">Nota del cliente</dt><dd className="mt-0.5">{pedido.nota}</dd></div>}
      </dl>

      {isLoading ? <Skeleton className="h-24 w-full" /> : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {lineas.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 p-3 text-sm">
              <span>{l.descripcion}<span className="block text-xs text-muted-foreground">{l.cantidad} × {fmt(l.precio)}</span></span>
              <span className="font-semibold tabular-nums">{fmt(l.cantidad * l.precio)}</span>
            </li>
          ))}
          <li className="flex justify-between p-3 font-display text-2xl font-bold"><span>Total</span><span className="tabular-nums">{fmt(pedido.total)}</span></li>
        </ul>
      )}

      <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Este pedido es de tu tienda y no descuenta el inventario de Elite Sport. Los precios son los que tú fijaste.</p>

      <div className="flex flex-wrap gap-2">
        <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" className={cn(buttonVariants({ variant: 'outline' }))}>Escribir al cliente</a>
        {pedido.estado === 'nuevo' && <Button disabled={actualizar.isPending} onClick={() => cambiar('confirmado', 'Pedido en proceso')}>Aceptar pedido</Button>}
        {pedido.estado === 'confirmado' && <Button variant="solid" disabled={actualizar.isPending} onClick={() => cambiar('entregado', 'Pedido entregado')}>Marcar entregado</Button>}
        {(pedido.estado === 'nuevo' || pedido.estado === 'confirmado') && (
          <Button variant="ghost" disabled={actualizar.isPending} onClick={() => cambiar('cancelado', 'Pedido cancelado')}>Cancelar</Button>
        )}
      </div>
    </div>
  )
}

/** Pedidos que hacen los clientes desde la tienda del mayorista. Es distinto de lo que él le pide a Elite Sport. */
export function ClientesPage() {
  const { data = [], isLoading } = useMisPedidos()
  const moneda = useMoneyStore((s) => s.config)
  const [filtro, setFiltro] = useState<Filtro>('nuevo')
  const [abierto, setAbierto] = useState<string | null>(null)

  const pedidos = useMemo(() => data.filter((p) => p.tipo === 'lead_tienda'), [data])
  const nuevos = pedidos.filter((p) => p.estado === 'nuevo').length
  const lista = filtro === 'todos' ? pedidos : pedidos.filter((p) => p.estado === filtro)
  const actual = pedidos.find((p) => p.id === abierto) ?? null

  return (
    <>
      <PageHeader title="Pedidos de mis clientes" description="Aquí llegan los pedidos que hacen tus clientes desde tu tienda, aunque no abran WhatsApp. Los atiendes tú, con tu propio abastecimiento." />
      <Tabs
        className="mb-6"
        value={filtro}
        onChange={setFiltro}
        tabs={[
          { id: 'nuevo', label: `Nuevos${nuevos ? ` (${nuevos})` : ''}` },
          { id: 'confirmado', label: 'En proceso' },
          { id: 'entregado', label: 'Entregados' },
          { id: 'cancelado', label: 'Cancelados' },
          { id: 'todos', label: 'Todos' },
        ]}
      />
      {isLoading ? <Skeleton className="h-40 w-full" /> : lista.length === 0 ? (
        <EmptyState
          title={pedidos.length === 0 ? 'Aún no te han pedido' : 'Nada en esta lista'}
          description={pedidos.length === 0 ? 'Comparte el enlace de tu tienda para recibir pedidos. Aparecerán aquí al instante.' : 'Cambia de pestaña para ver los demás.'}
          action={pedidos.length === 0 ? <Link to="/mayorista/compartir" className="underline underline-offset-4">Compartir mi tienda</Link> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {lista.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setAbierto(p.id)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground">
                <span>
                  <strong className="tabular-nums">#{p.numero}</strong> · {p.cliente}
                  <span className="block text-xs text-muted-foreground">{fecha.format(new Date(p.creadoEn))}{p.direccion ? ` · ${p.direccion}` : ''}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge variant={TONO[p.estado]}>{ESTADOS[p.estado]}</Badge>
                  <span className="font-semibold tabular-nums">{formatMoney(p.total, moneda)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!actual} onOpenChange={(o) => !o && setAbierto(null)}>
        {actual && (
          <SheetContent title={`Pedido #${actual.numero}`} description={ESTADOS[actual.estado]}>
            <Detalle pedido={actual} onCerrar={() => setAbierto(null)} />
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}

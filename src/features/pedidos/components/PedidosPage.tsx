import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import type { EstadoPedido, PedidoFila, TipoPedido } from '../api/pedidos'
import { useAccionPedido, useDetallePedido, usePedidos } from '../hooks/usePedidos'

const TIPOS: Record<TipoPedido, string> = { minorista: 'Público', mayorista: 'Mayorista', lead_tienda: 'Tienda de mayorista', mostrador: 'Venta en tienda', consignacion: 'Entrega de bodega' }
const ESTADOS: Record<EstadoPedido, string> = { nuevo: 'Nuevo', confirmado: 'Confirmado', entregado: 'Entregado', cancelado: 'Cancelado', liquidado: 'Liquidado' }
const TONO: Record<EstadoPedido, 'signal' | 'warning' | 'success' | 'neutral'> = { nuevo: 'signal', confirmado: 'warning', entregado: 'success', cancelado: 'neutral', liquidado: 'success' }
const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

function Detalle({ pedido, onCerrar }: { pedido: PedidoFila; onCerrar: () => void }) {
  const { data: lineas = [], isLoading } = useDetallePedido(pedido.id)
  const accion = useAccionPedido()
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)

  function ejecutar(a: 'confirmar' | 'cancelar' | 'entregar') {
    accion.mutate(
      { accion: a, id: pedido.id },
      {
        onSuccess: () => {
          toast.success(a === 'confirmar' ? 'Pedido confirmado y stock descontado' : a === 'entregar' ? 'Pedido entregado' : 'Pedido cancelado')
          onCerrar()
        },
        onError: (e) => toast.error(mensajeError(e)),
      },
    )
  }

  const afectaStock = pedido.tipo !== 'lead_tienda'
  const esMostrador = pedido.tipo === 'mostrador'
  const esBodega = pedido.tipo === 'consignacion'
  const tel = pedido.telefono.replace(/[^\d]/g, '')
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div><dt className="eyebrow">Cliente</dt><dd className="mt-0.5 font-semibold">{pedido.cliente}</dd></div>
        <div><dt className="eyebrow">Celular</dt><dd className="mt-0.5"><a className="underline underline-offset-4" href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer">{pedido.telefono}</a></dd></div>
        {pedido.documento && <div><dt className="eyebrow">Cédula o RUC</dt><dd className="mt-0.5">{pedido.documento}</dd></div>}
        {pedido.correo && <div><dt className="eyebrow">Correo</dt><dd className="mt-0.5 break-all"><a className="underline underline-offset-4" href={`mailto:${pedido.correo}`}>{pedido.correo}</a></dd></div>}
        {pedido.direccion && <div className="col-span-2"><dt className="eyebrow">Dirección de entrega</dt><dd className="mt-0.5">{pedido.direccion}</dd></div>}
        {pedido.metodoPago && <div><dt className="eyebrow">Pago</dt><dd className="mt-0.5 capitalize">{pedido.metodoPago}</dd></div>}
        <div><dt className="eyebrow">Tipo</dt><dd className="mt-0.5">{TIPOS[pedido.tipo]}</dd></div>
        <div><dt className="eyebrow">Origen</dt><dd className="mt-0.5">{pedido.origen}</dd></div>
        <div className="col-span-2"><dt className="eyebrow">Fecha</dt><dd className="mt-0.5">{fecha.format(new Date(pedido.creadoEn))}</dd></div>
        {pedido.nota && <div className="col-span-2"><dt className="eyebrow">Nota</dt><dd className="mt-0.5">{pedido.nota}</dd></div>}
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

      {esBodega && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Es una entrega de bodega: se despacha y se cierra desde Bodega. El total es lo vendido al cierre.</p>}
      {!afectaStock && <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">Es una venta de la tienda de un mayorista: no afecta el inventario central.</p>}

      <div className="flex flex-wrap gap-2">
        {pedido.estado === 'nuevo' && afectaStock && !esMostrador && !esBodega && <Button disabled={accion.isPending} onClick={() => ejecutar('confirmar')}>Confirmar y descontar stock</Button>}
        {pedido.estado === 'confirmado' && !esBodega && <Button variant="solid" disabled={accion.isPending} onClick={() => ejecutar('entregar')}>Marcar entregado</Button>}
        {(pedido.estado === 'nuevo' || (pedido.estado === 'confirmado' && !esBodega) || (esMostrador && pedido.estado === 'entregado')) && (
          <Button variant="outline" disabled={accion.isPending} onClick={() => ejecutar('cancelar')}>
            {esMostrador ? 'Anular venta' : pedido.estado === 'confirmado' ? 'Anular y reponer stock' : 'Cancelar'}
          </Button>
        )}
      </div>
    </div>
  )
}

export function PedidosPage() {
  const { data = [], isLoading, error } = usePedidos()
  const moneda = useMoneyStore((s) => s.config)
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<PedidoFila | null>(null)

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter((p) => (!tipo || p.tipo === tipo) && (!estado || p.estado === estado) && (!t || `${p.numero} ${p.cliente} ${p.origen}`.toLowerCase().includes(t)))
  }, [data, tipo, estado, q])

  return (
    <>
      <PageHeader title="Pedidos" description="Confirmar un pedido descuenta el stock; cancelarlo lo repone." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem_12rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente u origen" aria-label="Buscar pedidos" />
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {error && <p role="alert" className="text-destructive">No se pudieron cargar los pedidos.</p>}
      {!isLoading && filas.length === 0 && <EmptyState title="Sin pedidos" description="Los pedidos del público, de mayoristas y de sus tiendas aparecen aquí." />}
      {filas.length > 0 && (
        <Table>
          <THead>
            <TR><TH>N.°</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH className="text-right">Total</TH><TH>Fecha</TH></TR>
          </THead>
          <TBody>
            {filas.map((p) => (
              <TR key={p.id} className="cursor-pointer" onClick={() => setAbierto(p)}>
                <TD className="font-semibold tabular-nums">
                  <button type="button" className="underline-offset-4 hover:underline focus-visible:underline" onClick={() => setAbierto(p)}>#{p.numero}</button>
                </TD>
                <TD>{p.cliente}<span className="block text-xs text-muted-foreground">{p.origen}</span></TD>
                <TD>{TIPOS[p.tipo]}</TD>
                <TD><Badge variant={TONO[p.estado]}>{ESTADOS[p.estado]}</Badge></TD>
                <TD className="text-right font-semibold tabular-nums">{formatMoney(p.total, moneda)}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{fecha.format(new Date(p.creadoEn))}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Sheet open={!!abierto} onOpenChange={(o) => !o && setAbierto(null)}>
        {abierto && (
          <SheetContent title={`Pedido #${abierto.numero}`} description={`${TIPOS[abierto.tipo]} · ${ESTADOS[abierto.estado]}`}>
            <Detalle pedido={abierto} onCerrar={() => setAbierto(null)} />
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}

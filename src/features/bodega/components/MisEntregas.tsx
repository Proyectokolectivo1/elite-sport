import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import type { MiEntrega } from '../api/bodega'
import { useCancelarPedidoBodega, useMisEntregas } from '../hooks/useBodega'

const ESTADO: Record<MiEntrega['estado'], { texto: string; tono: 'signal' | 'warning' | 'success' | 'neutral' }> = {
  nuevo: { texto: 'En espera de bodega', tono: 'signal' },
  confirmado: { texto: 'Confirmado', tono: 'warning' },
  entregado: { texto: 'En tu poder', tono: 'warning' },
  liquidado: { texto: 'Cerrada', tono: 'success' },
  cancelado: { texto: 'Cancelado', tono: 'neutral' },
}
const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

interface Props {
  /** Solo estas entregas (por estado). */
  estados?: MiEntrega['estado'][]
  /** Muestra el total liquidado (mayorista del sector). */
  conTotal?: boolean
  vacio: string
}

export function MisEntregas({ estados, conTotal = false, vacio }: Props) {
  const { data = [], isLoading, error } = useMisEntregas()
  const cancelar = useCancelarPedidoBodega()
  const moneda = useMoneyStore((s) => s.config)
  const filas = estados ? data.filter((e) => estados.includes(e.estado)) : data

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (error) return <p role="alert" className="text-destructive">{mensajeError(error)}</p>
  if (filas.length === 0) return <EmptyState title="Sin entregas" description={vacio} />

  return (
    <ul className="space-y-3">
      {filas.map((e) => (
        <li key={e.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-2xl font-bold uppercase leading-none">Pedido #{e.numero}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fecha.format(new Date(e.liquidadoEn ?? e.despachadoEn ?? e.creadoEn))}</p>
            </div>
            <Badge variant={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Badge>
          </div>
          <ul className="mt-3 divide-y divide-border text-sm">
            {e.lineas.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{l.descripcion}</span>
                <span className="tabular-nums text-muted-foreground">
                  {e.estado === 'nuevo' || e.estado === 'cancelado'
                    ? `Pediste ${l.cantidad}`
                    : e.estado === 'entregado'
                      ? `Recibiste ${l.entregada ?? 0} · vendidos ${l.vendida ?? 0} · regresaron ${l.devuelta ?? 0}`
                      : `Vendidos ${l.vendida ?? 0} · regresaron ${l.devuelta ?? 0}`}
                </span>
              </li>
            ))}
          </ul>
          {conTotal && e.estado === 'liquidado' && (
            <p className="mt-3 flex justify-between border-t border-border pt-3 font-semibold"><span>Total vendido</span><span className="tabular-nums">{formatMoney(e.total, moneda)}</span></p>
          )}
          {e.estado === 'nuevo' && (
            <Button size="sm" variant="ghost" className="mt-2 text-destructive" disabled={cancelar.isPending}
              onClick={() => cancelar.mutate(e.id, { onSuccess: () => toast.success('Pedido cancelado'), onError: (x) => toast.error(mensajeError(x)) })}>
              Cancelar pedido
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

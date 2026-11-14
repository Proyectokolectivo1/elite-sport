import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { PedidoBodega } from '../api/bodega'
import { useCerrarEntrega, useDevolucion } from '../hooks/useBodega'
import { conVendidos, cuadreEntrega, cuadreLinea, pendiente, valoresIniciales, vendidosSinRegistrar, type LineaEntrega, type ValorCierre } from '../logica'

const hora = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })

/** Cierre de una entrega: por línea, vendidos + regresan debe dar lo entregado. */
export function CierreEntrega({ pedido }: { pedido: PedidoBodega }) {
  const cerrar = useCerrarEntrega()
  const devolver = useDevolucion()
  const esVendedor = pedido.solicitante_rol === 'vendedor'

  const lineas: (LineaEntrega & { descripcion: string })[] = useMemo(
    () =>
      pedido.lineas
        .filter((l) => (l.cantidad_entregada ?? 0) > 0)
        .map((l) => ({
          id: l.id,
          descripcion: l.descripcion,
          entregada: l.cantidad_entregada ?? 0,
          vendida: l.cantidad_vendida ?? 0,
          devuelta: l.cantidad_devuelta ?? 0,
        })),
    [pedido.lineas],
  )
  const [valores, setValores] = useState<Record<string, ValorCierre>>(() => valoresIniciales(lineas))
  const ok = cuadreEntrega(lineas, valores)
  const extra = vendidosSinRegistrar(lineas, valores)
  const enPoder = lineas.reduce((s, l) => s + pendiente(l), 0)
  const devueltosAhora = lineas.reduce((s, l) => s + (valores[l.id]?.devueltos ?? 0), 0)

  function poner(l: LineaEntrega, campo: keyof ValorCierre, n: number) {
    setValores((v) => ({ ...v, [l.id]: campo === 'vendidos' ? conVendidos(l, n) : { vendidos: v[l.id]?.vendidos ?? l.vendida, devueltos: Math.trunc(n) || 0 } }))
  }

  function cerrarEntrega() {
    cerrar.mutate(
      { id: pedido.id, lineas: lineas.map((l) => ({ detalleId: l.id, vendidos: valores[l.id].vendidos, devueltos: valores[l.id].devueltos })) },
      {
        onSuccess: (r) =>
          toast.success(
            r.ventaSinRegistrar
              ? `Entrega #${pedido.numero} cerrada. Lo vendido sin registrar quedó como venta #${r.ventaSinRegistrar}.`
              : `Entrega #${pedido.numero} cerrada. El inventario ya tiene los pares que regresaron.`,
          ),
        onError: (e) => toast.error(mensajeError(e)),
      },
    )
  }

  function recibirParcial() {
    const items = lineas
      .map((l) => ({ detalleId: l.id, devueltos: Math.min(valores[l.id]?.devueltos ?? 0, pendiente(l)) }))
      .filter((x) => x.devueltos > 0)
    devolver.mutate(
      { id: pedido.id, lineas: items },
      {
        onSuccess: () => toast.success(`Recibidos ${items.reduce((s, x) => s + x.devueltos, 0)} pares. La entrega sigue abierta.`),
        onError: (e) => toast.error(mensajeError(e)),
      },
    )
  }

  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-bold uppercase leading-none">Entrega #{pedido.numero}</p>
        <p className="text-sm text-muted-foreground">
          {pedido.despachado_en && `Salió a las ${hora.format(new Date(pedido.despachado_en))} · `}
          <strong className="text-foreground tabular-nums">{enPoder}</strong> pares en su poder
        </p>
      </div>

      <ul className="divide-y divide-border">
        {lineas.map((l) => {
          const v = valores[l.id]
          const c = cuadreLinea(l, v)
          return (
            <li key={l.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{l.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  Entregados <strong className="text-foreground tabular-nums">{l.entregada}</strong>
                  {esVendedor && <> · registrados <strong className="text-foreground tabular-nums">{l.vendida}</strong></>}
                  {l.devuelta > 0 && <> · ya regresaron {l.devuelta}</>}
                </p>
                {c.mensaje && <p className="text-xs text-destructive">{c.mensaje}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Vendidos
                  <Input type="number" min={l.vendida} inputMode="numeric" aria-label={`Vendidos de ${l.descripcion}`} aria-invalid={!c.ok}
                    className={cn('mt-1 h-11 text-right text-base sm:w-24', !c.ok && 'border-destructive')} value={v?.vendidos ?? ''} onChange={(e) => poner(l, 'vendidos', Number(e.target.value))} />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Regresan
                  <Input type="number" min={0} inputMode="numeric" aria-label={`Regresan de ${l.descripcion}`} aria-invalid={!c.ok}
                    className={cn('mt-1 h-11 text-right text-base sm:w-24', !c.ok && 'border-destructive')} value={v?.devueltos ?? ''} onChange={(e) => poner(l, 'devueltos', Number(e.target.value))} />
                </label>
              </div>
            </li>
          )
        })}
      </ul>

      {esVendedor && extra > 0 && ok && (
        <p className="rounded-md bg-warning/10 p-3 text-sm">
          {extra === 1 ? 'Hay 1 par vendido' : `Hay ${extra} pares vendidos`} que el vendedor no registró. Quedará como una venta en efectivo para que el administrador la revise.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!ok || cerrar.isPending} onClick={cerrarEntrega}>{cerrar.isPending ? 'Cerrando…' : 'Cerrar entrega'}</Button>
        <Button variant="outline" disabled={devolver.isPending || devueltosAhora === 0} onClick={recibirParcial}>
          Solo recibir lo que regresa
        </Button>
      </div>
      {!ok && <p className="text-sm text-muted-foreground">El cierre se activa cuando cada línea cuadra: vendidos + regresan = entregados.</p>}
    </article>
  )
}

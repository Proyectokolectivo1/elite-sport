import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import type { PedidoBodega } from '../api/bodega'
import { useCerrarEntrega, useDevolucion, useFotoDeVariante } from '../hooks/useBodega'
import { Contador } from './Contador'
import { FotoPar } from './FotoPar'
import { partesLinea } from './partesLinea'
import { aLiberar, conDevueltos, conVendidos, cuadreEntrega, cuadreLinea, pendiente, repartibles, valoresIniciales, vendidosSinRegistrar, type LineaEntrega, type ValorCierre } from '../logica'

const hora = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })

/** Cierre de una entrega: por línea, vendidos + regresan debe dar lo entregado. */
export function CierreEntrega({ pedido }: { pedido: PedidoBodega }) {
  const cerrar = useCerrarEntrega()
  const devolver = useDevolucion()
  const esVendedor = pedido.solicitante_rol === 'vendedor'
  const foto = useFotoDeVariante()

  const lineas: (LineaEntrega & { descripcion: string; varianteId: string })[] = useMemo(
    () =>
      pedido.lineas
        .filter((l) => (l.cantidad_entregada ?? 0) > 0)
        .map((l) => ({
          id: l.id,
          descripcion: l.descripcion,
          varianteId: l.variante_id,
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

  // Vendidos y regresan se completan entre sí: lo que no se vendió regresa, y viceversa.
  function poner(l: LineaEntrega, campo: keyof ValorCierre, n: number) {
    setValores((v) => ({ ...v, [l.id]: campo === 'vendidos' ? conVendidos(l, n) : conDevueltos(l, n) }))
  }

  function cerrarEntrega() {
    cerrar.mutate(
      {
        id: pedido.id,
        lineas: lineas.map((l) => ({ detalleId: l.id, vendidos: valores[l.id].vendidos, devueltos: valores[l.id].devueltos })),
        liberar: lineas.map((l) => ({ detalleId: l.id, cantidad: aLiberar(l, valores[l.id].vendidos) })),
      },
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
      .map((l) => ({ detalleId: l.id, devueltos: Math.min(valores[l.id]?.devueltos ?? 0, repartibles(l)) }))
      .filter((x) => x.devueltos > 0)
    const liberar = lineas.map((l) => ({ detalleId: l.id, cantidad: aLiberar(l, repartibles(l) - Math.min(valores[l.id]?.devueltos ?? 0, repartibles(l))) }))
    devolver.mutate(
      { id: pedido.id, lineas: items, liberar },
      {
        onSuccess: () => toast.success(`Recibidos ${items.reduce((s, x) => s + x.devueltos, 0)} pares. La entrega sigue abierta.`),
        onError: (e) => toast.error(mensajeError(e)),
      },
    )
  }

  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-bold uppercase leading-none">
          Entrega #{pedido.numero}
          {pedido.solicitante_nombre && <span className="ml-2 text-muted-foreground">· {pedido.solicitante_nombre}</span>}
        </p>
        <p className="text-sm text-muted-foreground">
          {pedido.despachado_en && `Salió a las ${hora.format(new Date(pedido.despachado_en))} · `}
          <strong className="text-foreground tabular-nums">{enPoder}</strong> {enPoder === 1 ? 'par' : 'pares'} en su poder
        </p>
      </div>

      <ul className="divide-y divide-border">
        {lineas.map((l) => {
          const v = valores[l.id]
          const c = cuadreLinea(l, v)
          const partes = partesLinea(l.descripcion)
          return (
            <li key={l.id} className="grid gap-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <FotoPar src={foto(l.varianteId)} alt={l.descripcion} className="aspect-square w-full rounded-xl sm:size-40 sm:w-40" />
              <div className="min-w-0 space-y-2">
                <p className="font-display text-2xl font-bold uppercase leading-tight">{partes.nombre}</p>
                {partes.color && (
                  <p className="flex items-center gap-3">
                    <span className="text-muted-foreground">{partes.color}</span>
                    <span className="rounded-lg bg-foreground px-3 py-1 text-xl font-bold tabular-nums text-background">Talla {partes.talla}</span>
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Entregados <strong className="text-lg text-foreground tabular-nums">{l.entregada}</strong>
                  {esVendedor && <> · registrados <strong className="text-foreground tabular-nums">{l.vendida}</strong></>}
                  {l.devuelta > 0 && <> · ya regresaron {l.devuelta}</>}
                </p>
                {c.mensaje && <p className="text-sm text-destructive">{c.mensaje}</p>}
                {l.vendida > 0 && (v?.vendidos ?? l.vendida) < l.vendida && (
                  <p className="text-sm text-warning">
                    Se anulará {l.vendida - (v?.vendidos ?? l.vendida) === 1 ? '1 venta registrada' : `${l.vendida - (v?.vendidos ?? l.vendida)} ventas registradas`} por el vendedor: el par vuelve al inventario.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex">
                <Contador
                  etiqueta="Vendidos"
                  ariaLabel={`Vendidos de ${l.descripcion}`}
                  valor={v?.vendidos ?? l.vendida}
                  min={0}
                  max={repartibles(l)}
                  invalido={!c.ok}
                  onChange={(n) => poner(l, 'vendidos', n)}
                />
                <Contador
                  etiqueta="Regresan"
                  ariaLabel={`Regresan de ${l.descripcion}`}
                  valor={v?.devueltos ?? 0}
                  min={0}
                  max={repartibles(l)}
                  invalido={!c.ok}
                  onChange={(n) => poner(l, 'devueltos', n)}
                />
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

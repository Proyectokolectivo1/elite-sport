import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { Contador } from '@/features/bodega/components/Contador'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { PedidoDevolvible } from '../api/devoluciones'
import { useDevoluciones, usePedidosDevolvibles, useRegistrarDevolucion } from '../hooks/useDevoluciones'
import { porDevolver, resumenDevolucion } from '../logica'
import { devolucionSchema, MOTIVOS, nombreMotivo, type DevolucionValues } from '../schemas'

const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })
const NOMBRE_TIPO: Record<string, string> = { minorista: 'Tienda en línea', mayorista: 'Mayorista', lead_tienda: 'WhatsApp', mostrador: 'Local', consignacion: 'Vendedor del local' }
const pares = (n: number) => `${n} ${n === 1 ? 'par' : 'pares'}`

/** Devoluciones después de una compra. Solo las maneja el admin. */
export function DevolucionesPage() {
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const pedidos = usePedidosDevolvibles()
  const historial = useDevoluciones()
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<PedidoDevolvible | null>(null)

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^#/, '')
    const lista = pedidos.data ?? []
    if (!t) return lista.slice(0, 30)
    return lista.filter((p) => String(p.numero) === t || p.cliente.toLowerCase().includes(t) || p.telefono.includes(t)).slice(0, 30)
  }, [pedidos.data, q])

  return (
    <>
      <PageHeader title="Devoluciones" description="Registra los pares que un cliente devuelve después de comprar, también de las ventas de los vendedores de los locales. Si el par está en buen estado, vuelve al inventario único de bodega." />

      <section aria-label="Registrar devolución" className="mb-10 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div>
          <Label htmlFor="dev-buscar">Buscar la compra</Label>
          <Input id="dev-buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="N.° de pedido, cliente o teléfono" />
          <div className="mt-3 space-y-2">
            {pedidos.isLoading && <Skeleton className="h-40 w-full" />}
            {pedidos.error && <p role="alert" className="text-destructive">{mensajeError(pedidos.error)}</p>}
            {!pedidos.isLoading && filtrados.length === 0 && <p className="text-sm text-muted-foreground">No hay compras entregadas con ese dato.</p>}
            {filtrados.map((p) => {
              const libres = p.lineas.reduce((s, l) => s + porDevolver(l), 0)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setElegido(p)}
                  className={cn(
                    'w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-foreground',
                    elegido?.id === p.id && 'border-foreground',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <strong className="tabular-nums">#{p.numero}</strong>
                    <span className="text-sm tabular-nums">{fmt(p.total)}</span>
                  </span>
                  <span className="block text-sm">{p.cliente}</span>
                  <span className="block text-xs text-muted-foreground">
                    {NOMBRE_TIPO[p.tipo] ?? p.tipo} · {fecha.format(new Date(p.creadoEn))}
                    {libres === 0 && ' · ya devuelto por completo'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {elegido ? (
          <FormularioDevolucion key={elegido.id} pedido={elegido} fmt={fmt} onListo={() => setElegido(null)} />
        ) : (
          <EmptyState title="Elige una compra" description="Busca el pedido del cliente para marcar qué pares devuelve." />
        )}
      </section>

      <section aria-label="Devoluciones registradas">
        <h2 className="mb-3 text-3xl">Registradas</h2>
        {historial.isLoading && <Skeleton className="h-32 w-full" />}
        {historial.error && <p role="alert" className="text-destructive">{mensajeError(historial.error)}</p>}
        {!historial.isLoading && (historial.data ?? []).length === 0 && <EmptyState title="Sin devoluciones" description="Cuando registres la primera, aparecerá aquí." />}
        <ul className="space-y-3">
          {(historial.data ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-2xl font-bold uppercase leading-none">
                  Devolución #{d.numero}
                  <span className="ml-2 text-base font-normal normal-case text-muted-foreground">
                    · pedido #{d.pedidoNumero} · {d.cliente}
                  </span>
                </p>
                <p className="font-display text-3xl font-bold leading-none tabular-nums">{fmt(d.total)}</p>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {fecha.format(new Date(d.creadoEn))}
                <Badge variant="outline">{nombreMotivo(d.motivo)}</Badge>
                <Badge variant={d.reintegrado ? 'success' : 'neutral'}>{d.reintegrado ? 'Volvió al inventario' : 'No volvió al inventario'}</Badge>
              </p>
              <ul className="mt-2 text-sm">
                {d.lineas.map((l) => (
                  <li key={l.id}>
                    <strong className="tabular-nums">{l.cantidad}</strong> × {l.descripcion}
                  </li>
                ))}
              </ul>
              {d.nota && <p className="mt-2 text-sm text-muted-foreground">{d.nota}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

function FormularioDevolucion({ pedido, fmt, onListo }: { pedido: PedidoDevolvible; fmt: (n: number) => string; onListo: () => void }) {
  const registrar = useRegistrarDevolucion()
  const [elegidos, setElegidos] = useState<Record<string, number>>({})
  const { register, handleSubmit, formState } = useForm<DevolucionValues>({
    resolver: zodResolver(devolucionSchema),
    defaultValues: { motivo: 'talla', reintegrar: true, nota: '' },
  })
  const { pares: nPares, total } = resumenDevolucion(pedido.lineas, elegidos)

  function enviar(datos: DevolucionValues) {
    const lineas = pedido.lineas.filter((l) => (elegidos[l.id] ?? 0) > 0).map((l) => ({ detalleId: l.id, cantidad: elegidos[l.id] }))
    registrar.mutate(
      { pedidoId: pedido.id, lineas, datos },
      {
        onSuccess: (r) => {
          toast.success(`Devolución #${r.numero} registrada: ${pares(r.pares)}, ${fmt(r.total)} a devolver al cliente.`)
          onListo()
        },
        onError: (e) => toast.error(mensajeError(e)),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit(enviar)} className="space-y-5 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="font-display text-3xl font-bold uppercase leading-none">Pedido #{pedido.numero}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {pedido.cliente} · {NOMBRE_TIPO[pedido.tipo] ?? pedido.tipo} · {fecha.format(new Date(pedido.creadoEn))}
        </p>
      </div>

      <ul className="divide-y divide-border">
        {pedido.lineas.map((l) => {
          const libres = porDevolver(l)
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{l.descripcion}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  Compró {l.cantidad} · {fmt(l.precio)} c/u{l.devuelta > 0 && ` · ya devolvió ${l.devuelta}`}
                </p>
              </div>
              {libres > 0 ? (
                <Contador
                  etiqueta="Devuelve"
                  ariaLabel={`Devuelve de ${l.descripcion}`}
                  valor={elegidos[l.id] ?? 0}
                  min={0}
                  max={libres}
                  onChange={(n) => setElegidos((e) => ({ ...e, [l.id]: n }))}
                />
              ) : (
                <Badge variant="neutral">Ya devuelto</Badge>
              )}
            </li>
          )
        })}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="dev-motivo">Motivo</Label>
          <Select id="dev-motivo" {...register('motivo')}>
            {MOTIVOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
        </div>
        <label className="flex items-start gap-3 self-end rounded-lg border border-border p-3 text-sm">
          <input type="checkbox" className="mt-0.5 size-4" {...register('reintegrar')} />
          <span>
            <strong>Los pares vuelven al inventario</strong>
            <span className="block text-muted-foreground">Desmárcalo si están dañados o no se pueden revender.</span>
          </span>
        </label>
      </div>
      <div>
        <Label htmlFor="dev-nota">Nota (opcional)</Label>
        <Textarea id="dev-nota" rows={2} {...register('nota')} />
        <FieldError>{formState.errors.nota?.message}</FieldError>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p>
          A devolver al cliente: <strong className="font-display text-3xl tabular-nums">{fmt(total)}</strong>
          <span className="ml-2 text-sm text-muted-foreground">{pares(nPares)}</span>
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onListo}>Cancelar</Button>
          <Button type="submit" disabled={nPares === 0 || registrar.isPending}>{registrar.isPending ? 'Registrando…' : 'Registrar devolución'}</Button>
        </div>
      </div>
    </form>
  )
}

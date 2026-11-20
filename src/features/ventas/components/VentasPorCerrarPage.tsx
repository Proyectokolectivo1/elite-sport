import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { MetodoPago, VentaPorCerrar } from '../api/ventas'
import { useAnularVentaLocal, useCerrarVentaLocal, useVentasPorCerrar } from '../hooks/useVentas'
import { preciosDeCierre, totalCierre } from '../ventaLogica'

const PAGOS: { id: MetodoPago; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
]
const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' })

/** El admin cierra las ventas que los vendedores dejaron listas: valor final y forma de pago. */
export function VentasPorCerrarPage() {
  const { data: ventas = [], isLoading, error } = useVentasPorCerrar()
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const pendiente = ventas.reduce((s, v) => s + v.total, 0)

  return (
    <>
      <PageHeader
        title="Ventas por cerrar"
        description="Los vendedores arman la venta; tú la cierras. Aquí fijas el valor final y la forma de pago. Solo al cerrarla cuenta en la caja."
      />
      {error && <p role="alert" className="mb-6 text-destructive">{mensajeError(error)}</p>}
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : ventas.length === 0 ? (
        <EmptyState title="No hay ventas por cerrar" description="Cuando un vendedor registre una venta del local, aparecerá aquí." />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {ventas.length} {ventas.length === 1 ? 'venta' : 'ventas'} · <strong className="text-foreground tabular-nums">{fmt(pendiente)}</strong> a precio de lista
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {ventas.map((v) => (
              <TarjetaVenta key={v.id} venta={v} fmt={fmt} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function TarjetaVenta({ venta, fmt }: { venta: VentaPorCerrar; fmt: (n: number) => string }) {
  const cerrar = useCerrarVentaLocal()
  const anular = useAnularVentaLocal()
  const [precios, setPrecios] = useState<Record<string, number>>({})
  const [pago, setPago] = useState<MetodoPago>(venta.metodoPago)
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = totalCierre(venta.lineas, precios)
  const ocupado = cerrar.isPending || anular.isPending

  async function onCerrar() {
    const r = preciosDeCierre(venta.lineas, precios)
    if (!r.ok) return setError(r.error)
    setError(null)
    try {
      const res = await cerrar.mutateAsync({ pedidoId: venta.id, precios: r.cambios, metodoPago: pago })
      toast.success(`Venta #${res.numero} cerrada por ${fmt(res.total)}`)
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  async function onAnular() {
    try {
      await anular.mutateAsync(venta.id)
      toast.success(`Venta #${venta.numero} anulada: los pares vuelven al vendedor`)
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <article aria-label={`Venta ${venta.numero}`} className="rounded-xl border border-border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl leading-tight">Venta #{venta.numero}</h2>
          <p className="text-sm text-muted-foreground">
            {venta.vendedor} · {fecha.format(new Date(venta.creadoEn))}
          </p>
        </div>
        <p className="text-right text-sm">
          {venta.cliente}
          {venta.documento && <span className="block text-muted-foreground">{venta.documento}</span>}
        </p>
      </header>

      <ul className="mt-3 divide-y divide-border">
        {venta.lineas.map((l) => {
          const valor = precios[l.id] ?? l.precio
          return (
            <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                {l.descripcion}
                <span className="block text-xs text-muted-foreground">
                  {l.cantidad} × lista {fmt(l.precio)}
                </span>
              </span>
              <Input
                aria-label={`Precio final de ${l.descripcion}`}
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                className="h-9 w-28 text-right"
                value={Number.isFinite(valor) ? valor : ''}
                onChange={(e) => setPrecios((p) => ({ ...p, [l.id]: e.target.value === '' ? Number.NaN : Number(e.target.value) }))}
              />
            </li>
          )
        })}
      </ul>
      {venta.nota && <p className="mt-2 rounded-md bg-muted p-2 text-sm">{venta.nota}</p>}

      <fieldset className="mt-3">
        <legend className="eyebrow mb-2">Forma de pago</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {PAGOS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={pago === p.id}
              onClick={() => setPago(p.id)}
              className={cn('h-10 rounded-lg border text-sm font-semibold', pago === p.id ? 'border-foreground bg-foreground text-background' : 'border-input')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">{total !== venta.total ? `Lista ${fmt(venta.total)}` : 'Total'}</span>
        <span className="font-display text-3xl font-bold tabular-nums">{fmt(total)}</span>
      </div>
      <FieldError>{error ?? undefined}</FieldError>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button className="flex-1" disabled={ocupado} onClick={() => void onCerrar()}>
          {cerrar.isPending ? 'Cerrando…' : `Cerrar venta ${fmt(total)}`}
        </Button>
        {confirmarAnular ? (
          <>
            <Button variant="outline" disabled={ocupado} onClick={() => void onAnular()}>
              {anular.isPending ? 'Anulando…' : 'Sí, anular'}
            </Button>
            <Button variant="ghost" disabled={ocupado} onClick={() => setConfirmarAnular(false)}>
              No
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled={ocupado} onClick={() => setConfirmarAnular(true)}>
            Anular
          </Button>
        )}
      </div>
    </article>
  )
}

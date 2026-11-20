import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useResumenVentas } from '../hooks/useCaja'
import { aFechaInput, NOMBRE_CANAL, periodo, resumirCanales, type ResumenCanal } from '../logica'

const plural = (n: number) => `${n} ${n === 1 ? 'venta' : 'ventas'}`

/** Cierre de caja del admin: lo vendido en el periodo, por canal y por quien lo vendió. */
export function CajaPage() {
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const [hoy] = useState(() => aFechaInput(new Date()))
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const rango = useMemo(() => periodo(desde, hasta), [desde, hasta])
  const { data: resumen, isLoading, error } = useResumenVentas(rango?.desde ?? null, rango?.hasta ?? null)
  const { canales, totalGeneral, pedidosGeneral } = useMemo(() => resumirCanales(resumen?.filas ?? []), [resumen])
  const porCerrar = resumen?.porCerrar
  const local = canales.find((c) => c.canal === 'local')
  const sector = canales.find((c) => c.canal === 'sector')

  function ultimosDias(dias: number) {
    const f = new Date()
    f.setDate(f.getDate() - dias)
    setDesde(aFechaInput(f))
    setHasta(aFechaInput(dias === 1 ? f : new Date()))
  }
  function esteMes() {
    const f = new Date()
    setDesde(aFechaInput(new Date(f.getFullYear(), f.getMonth(), 1)))
    setHasta(aFechaInput(f))
  }

  return (
    <>
      <PageHeader
        title="Cierre de caja"
        description="Lo vendido en el periodo, por canal de venta. Las ventas anuladas y los pedidos cancelados no cuentan."
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer /> Imprimir
          </Button>
        }
      />

      {porCerrar && porCerrar.pedidos > 0 && (
        <p role="status" className="mb-6 rounded-lg bg-warning/10 p-3 text-sm print:hidden">
          Hay {plural(porCerrar.pedidos)} del local por cerrar ({fmt(porCerrar.total)} a precio de lista). No cuentan en la caja hasta que las cierres.{' '}
          <Link to="/admin/por-cerrar" className="font-semibold underline underline-offset-4">Cerrar ventas</Link>
        </p>
      )}

      <section aria-label="Periodo" className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <div>
          <Label htmlFor="caja-desde">Desde</Label>
          <Input id="caja-desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="caja-hasta">Hasta</Label>
          <Input id="caja-hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => ultimosDias(0)}>Hoy</Button>
          <Button variant="outline" size="sm" onClick={() => ultimosDias(1)}>Ayer</Button>
          <Button variant="outline" size="sm" onClick={() => ultimosDias(6)}>7 días</Button>
          <Button variant="outline" size="sm" onClick={esteMes}>Este mes</Button>
        </div>
      </section>
      {!rango && <p role="alert" className="mb-4 text-destructive">Elige un periodo válido.</p>}
      {error && <p role="alert" className="mb-4 text-destructive">{mensajeError(error)}</p>}
      {isLoading && <Skeleton className="h-64 w-full" />}

      {rango && !isLoading && !error && (
        <>
          <section aria-label="Totales" className="mb-8 grid gap-3 md:grid-cols-3">
            <Total etiqueta="Total general" valor={fmt(totalGeneral)} nota={plural(pedidosGeneral)} grande />
            <Total etiqueta="Total del local" valor={fmt(local?.total ?? 0)} nota={plural(local?.pedidos ?? 0)} />
            <Total etiqueta="Total del sector" valor={fmt(sector?.total ?? 0)} nota={plural(sector?.pedidos ?? 0)} />
          </section>

          <div className="space-y-6">
            {canales.map((c) => (
              <Canal key={c.canal} c={c} fmt={fmt} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function Total({ etiqueta, valor, nota, grande }: { etiqueta: string; valor: string; nota: string; grande?: boolean }) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', grande && 'md:border-foreground')}>
      <p className="eyebrow">{etiqueta}</p>
      <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">{valor}</p>
      <p className="mt-2 text-sm text-muted-foreground">{nota}</p>
    </div>
  )
}

function Canal({ c, fmt }: { c: ResumenCanal; fmt: (n: number) => string }) {
  const info = NOMBRE_CANAL[c.canal]
  return (
    <section aria-label={info.titulo} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl">{info.titulo}</h2>
          <p className="text-sm text-muted-foreground">{info.descripcion}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl font-bold leading-none tabular-nums">{fmt(c.total)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{plural(c.pedidos)}</p>
        </div>
      </div>

      {c.canal === 'local' && c.total > 0 && (
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Pago etiqueta="Efectivo" valor={fmt(c.efectivo)} />
          <Pago etiqueta="Transferencia" valor={fmt(c.transferencia)} />
          <Pago etiqueta="Tarjeta" valor={fmt(c.tarjeta)} />
        </dl>
      )}
      {c.canal === 'sector' && c.total > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Por cobrar <strong className="text-foreground tabular-nums">{fmt(c.porCobrar)}</strong> · cobrado{' '}
          <strong className="text-foreground tabular-nums">{fmt(c.total - c.porCobrar)}</strong>
        </p>
      )}

      {c.filas.length === 0 && <p className="mt-4 text-sm text-muted-foreground">Sin ventas en este periodo.</p>}
      {c.filas.length > 0 && (c.canal === 'local' || c.canal === 'sector') && (
        <ul className="mt-4 divide-y divide-border">
          {c.filas.map((f) => (
            <li key={f.clave} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{f.nombre}</p>
                <p className="tabular-nums">
                  <strong className="text-lg">{fmt(f.total)}</strong>
                  <span className="ml-2 text-sm text-muted-foreground">{plural(f.pedidos)}</span>
                </p>
              </div>
              {c.canal === 'local' && (
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  Efectivo {fmt(f.efectivo)} · Transferencia {fmt(f.transferencia)} · Tarjeta {fmt(f.tarjeta)}
                </p>
              )}
              {c.canal === 'sector' && f.por_cobrar > 0 && <p className="mt-1 text-sm text-muted-foreground tabular-nums">Por cobrar {fmt(f.por_cobrar)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Pago({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="mt-1 font-display text-2xl font-bold tabular-nums">{valor}</dd>
    </div>
  )
}

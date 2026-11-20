import { useMemo, useState } from 'react'
import { ChevronDown, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs } from '@/components/ui/tabs'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { useReporteLocales } from '../hooks/useCaja'
import { agruparPorLocal, type DiaVentas, type LocalVentas, type Totales, type VentaLocal } from '../reporteLocales'
import { SelectorPeriodo, usePeriodo } from './SelectorPeriodo'

type Fmt = (n: number) => string

const hora = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })
const diaLargo = new Intl.DateTimeFormat('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
const PAGO: Record<NonNullable<VentaLocal['metodo_pago']>, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function nombreDia(dia: string) {
  const [a, m, d] = dia.split('-').map(Number)
  return diaLargo.format(new Date(a, m - 1, d))
}

/** Ventas del local para el admin: por tienda, por día y con el detalle de cada venta. */
export function VentasTiendasPage() {
  const moneda = useMoneyStore((s) => s.config)
  const fmt: Fmt = (n) => formatMoney(n, moneda)
  const per = usePeriodo()
  const { data = [], isLoading, error } = useReporteLocales(per.rango?.desde ?? null, per.rango?.hasta ?? null)
  const { locales, general } = useMemo(() => agruparPorLocal(data), [data])
  const [filtro, setFiltro] = useState('todas')
  const visibles = filtro === 'todas' ? locales : locales.filter((l) => l.clave === filtro)

  return (
    <>
      <PageHeader
        title="Ventas por tienda"
        description="Solo tú ves estos totales. Ventas del local ya cerradas, por tienda y por día, con el detalle de cada venta. Cuentan el día en que las cierras."
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer /> Imprimir
          </Button>
        }
      />
      <SelectorPeriodo p={per} id="tiendas" />
      {!per.rango && <p role="alert" className="mb-4 text-destructive">Elige un periodo válido.</p>}
      {error && <p role="alert" className="mb-4 text-destructive">{mensajeError(error)}</p>}
      {isLoading && <Skeleton className="h-64 w-full" />}

      {per.rango && !isLoading && !error && (
        data.length === 0 ? (
          <EmptyState title="Sin ventas en este periodo" description="Las ventas del local aparecen aquí cuando las cierras en Por cerrar." />
        ) : (
          <>
            <section aria-label="Totales del periodo" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Dato etiqueta="Total vendido" valor={fmt(general.total)} destacado />
              <Dato etiqueta="Ventas" valor={String(general.ventas)} />
              <Dato etiqueta="Pares" valor={String(general.pares)} />
              <Dato etiqueta="Rebajas sobre lista" valor={fmt(general.rebaja)} />
            </section>

            {locales.length > 1 && (
              <Tabs
                className="mb-6 print:hidden"
                tabs={[{ id: 'todas', label: 'Todas' }, ...locales.map((l) => ({ id: l.clave, label: l.nombre.replace(/^Local /, '') }))]}
                value={filtro}
                onChange={setFiltro}
              />
            )}

            <div className="space-y-8">
              {visibles.map((l) => (
                <Tienda key={l.clave} local={l} fmt={fmt} />
              ))}
            </div>
          </>
        )
      )}
    </>
  )
}

function Dato({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className={destacado ? 'rounded-xl border border-foreground bg-card p-4' : 'rounded-xl border border-border bg-card p-4'}>
      <p className="eyebrow">{etiqueta}</p>
      <p className="mt-1 font-display text-3xl font-bold leading-none tabular-nums md:text-4xl">{valor}</p>
    </div>
  )
}

function Pagos({ t, fmt }: { t: Totales; fmt: Fmt }) {
  return (
    <p className="text-sm tabular-nums text-muted-foreground">
      Efectivo {fmt(t.efectivo)} · Transferencia {fmt(t.transferencia)} · Tarjeta {fmt(t.tarjeta)}
    </p>
  )
}

function Tienda({ local, fmt }: { local: LocalVentas; fmt: Fmt }) {
  return (
    <section aria-label={local.nombre} className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-3xl">{local.nombre}</h2>
          <p className="text-sm text-muted-foreground">
            {plural(local.ventas, 'venta', 'ventas')} · {plural(local.pares, 'par', 'pares')}
            {local.rebaja > 0 && <> · rebajas {fmt(local.rebaja)}</>}
          </p>
        </div>
        <p className="font-display text-4xl font-bold leading-none tabular-nums">{fmt(local.total)}</p>
      </div>
      <div className="mt-2">
        <Pagos t={local} fmt={fmt} />
      </div>
      <ul className="mt-4 divide-y divide-border border-t border-border">
        {local.dias.map((d) => (
          <Dia key={d.dia} dia={d} fmt={fmt} />
        ))}
      </ul>
    </section>
  )
}

function Dia({ dia, fmt }: { dia: DiaVentas; fmt: Fmt }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block font-semibold capitalize">{nombreDia(dia.dia)}</span>
            <span className="block text-sm text-muted-foreground">
              {plural(dia.ventas, 'venta', 'ventas')} · {plural(dia.pares, 'par', 'pares')}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <strong className="text-xl tabular-nums">{fmt(dia.total)}</strong>
            <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 print:hidden" />
          </span>
        </summary>
        <div className="space-y-3 pb-4">
          <Pagos t={dia} fmt={fmt} />
          <ul className="space-y-3">
            {dia.detalle.map((v) => (
              <Venta key={v.id} v={v} fmt={fmt} />
            ))}
          </ul>
        </div>
      </details>
    </li>
  )
}

function Venta({ v, fmt }: { v: VentaLocal; fmt: Fmt }) {
  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          #{v.numero} · {hora.format(new Date(v.fecha))}
          <span className="ml-2 font-normal text-muted-foreground">{v.vendedor}</span>
        </p>
        <p className="tabular-nums">
          <strong>{fmt(v.total)}</strong>
          {v.metodo_pago && <span className="ml-2 text-sm text-muted-foreground">{PAGO[v.metodo_pago]}</span>}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        {v.cliente}
        {v.documento && ` · ${v.documento}`}
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {v.lineas.map((l, i) => (
          <li key={`${l.descripcion}-${i}`} className="flex justify-between gap-3">
            <span className="min-w-0">{l.descripcion}</span>
            <span className="shrink-0 text-right tabular-nums">
              {l.cantidad} × {fmt(l.precio)}
              {l.precio_lista !== null && l.precio_lista !== l.precio && (
                <span className="block text-xs text-muted-foreground">lista {fmt(l.precio_lista)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}

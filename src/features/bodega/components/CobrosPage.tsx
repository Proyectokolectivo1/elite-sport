import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { useCuentasSector, useMarcarPago } from '../hooks/useBodega'

const fecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' })

/** Cuánto debe cada mayorista del sector (cierres sin pagar) y cuánto podría deber aún si vende lo que tiene en su poder. */
export function CobrosPage() {
  const { data = [], isLoading, error } = useCuentasSector()
  const marcar = useMarcarPago()
  const moneda = useMoneyStore((s) => s.config)
  const total = data.reduce((s, c) => s + c.porCobrar, 0)
  const enPoder = data.reduce((s, c) => s + c.enPoderValor, 0)

  return (
    <>
      <PageHeader title="Cobros del sector" description="Lo que cada mayorista del sector debe pagar por lo que vendió. El monto sale de cada cierre del día, a su precio de mayorista." />
      {isLoading && <Skeleton className="h-48 w-full" />}
      {error && <p role="alert" className="text-destructive">{mensajeError(error)}</p>}
      {!isLoading && !error && data.length === 0 && <EmptyState title="Sin cuentas" description="Cuando un mayorista del sector cierre una entrega, su cobro aparecerá aquí." />}

      {data.length > 0 && (
        <>
          <section aria-label="Totales" className="mb-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="eyebrow">Por cobrar</p>
              <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">{formatMoney(total, moneda)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Cierres ya hechos que aún no se pagan.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="eyebrow">En manos de mayoristas</p>
              <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">{formatMoney(enPoder, moneda)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Mercancía aún sin cerrar, a su precio. Se cobra solo lo que vendan.</p>
            </div>
          </section>

          <div className="space-y-6">
            {data.map((c) => (
              <section key={c.id} aria-label={`Cuenta de ${c.negocio || c.nombre}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-3xl">{c.negocio || c.nombre}</h2>
                    {c.negocio && <p className="text-sm text-muted-foreground">{c.nombre}</p>}
                  </div>
                  <div className="text-right">
                    <p className="eyebrow">Debe</p>
                    <p className="font-display text-4xl font-bold leading-none tabular-nums">{formatMoney(c.porCobrar, moneda)}</p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pagado <strong className="text-foreground tabular-nums">{formatMoney(c.pagado, moneda)}</strong>
                  {c.enPoderPares > 0 && (
                    <> · tiene en su poder <strong className="text-foreground tabular-nums">{c.enPoderPares}</strong> {c.enPoderPares === 1 ? 'par' : 'pares'} ({formatMoney(c.enPoderValor, moneda)} si los vende todos)</>
                  )}
                </p>

                {c.cierres.length > 0 && (
                  <ul className="mt-3 divide-y divide-border text-sm">
                    {c.cierres.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <span>
                          <strong>Cierre #{x.numero}</strong>
                          {x.liquidadoEn && <span className="ml-2 text-muted-foreground">{fecha.format(new Date(x.liquidadoEn))}</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-3">
                          <span className="font-semibold tabular-nums">{formatMoney(x.total, moneda)}</span>
                          {x.pagadoEn ? <Badge variant="success">Pagado</Badge> : <Badge variant="warning">Por cobrar</Badge>}
                          <Button
                            size="sm"
                            variant={x.pagadoEn ? 'ghost' : 'solid'}
                            disabled={marcar.isPending}
                            onClick={() => marcar.mutate({ id: x.id, pagado: !x.pagadoEn }, { onError: (e) => toast.error(mensajeError(e)) })}
                          >
                            {x.pagadoEn ? 'Deshacer pago' : 'Marcar pagado'}
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  )
}

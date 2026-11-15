import { formatMoney, useMoneyStore } from '@/lib/money'
import { useMisEntregas } from '../hooks/useBodega'

/**
 * Lo que el mayorista del sector debe pagar: la suma de sus entregas ya cerradas que aún no se marcan como pagadas.
 * Lo que tiene en su poder todavía no se debe: se define al cerrar el día, según lo que venda.
 */
export function SaldoSector() {
  const { data = [] } = useMisEntregas()
  const moneda = useMoneyStore((s) => s.config)
  const cerradas = data.filter((e) => e.estado === 'liquidado' && e.total > 0)
  const porPagar = cerradas.filter((e) => !e.pagadoEn)
  const debe = porPagar.reduce((s, e) => s + e.total, 0)
  const pagado = cerradas.filter((e) => e.pagadoEn).reduce((s, e) => s + e.total, 0)

  return (
    <section aria-label="Lo que debes pagar" className="mb-8 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="eyebrow">Debes pagar</p>
        <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">{formatMoney(debe, moneda)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {porPagar.length === 0
            ? 'No tienes cierres pendientes de pago.'
            : `${porPagar.length === 1 ? '1 cierre' : `${porPagar.length} cierres`} sin pagar: ${porPagar.map((e) => `#${e.numero}`).join(', ')}.`}
        </p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="eyebrow">Ya pagado</p>
        <p className="mt-1 font-display text-5xl font-bold leading-none tabular-nums">{formatMoney(pagado, moneda)}</p>
        <p className="mt-2 text-sm text-muted-foreground">El pago lo registra el administrador cuando lo recibe.</p>
      </div>
    </section>
  )
}

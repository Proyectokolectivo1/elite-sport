import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { mensajeError } from '@/lib/errors'
import { useMisParesEnPoder } from '../hooks/useBodega'

/** Pares que el usuario tiene en su poder ahora, con su precio (PVP o el suyo de mayorista). */
export function EnPoderTabla({ etiquetaPrecio }: { etiquetaPrecio: string }) {
  const { data = [], isLoading, error } = useMisParesEnPoder()
  const moneda = useMoneyStore((s) => s.config)
  const total = data.reduce((s, p) => s + p.en_poder, 0)
  const valor = data.reduce((s, p) => s + p.en_poder * p.precio, 0)

  if (isLoading) return <Skeleton className="h-32 w-full" />
  if (error) return <p role="alert" className="text-destructive">{mensajeError(error)}</p>
  if (data.length === 0) return <EmptyState title="No tienes mercancía" description="Cuando bodega te despache un pedido, los pares aparecerán aquí." />

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        <strong className="text-foreground tabular-nums">{total}</strong> pares · {etiquetaPrecio} <strong className="text-foreground tabular-nums">{formatMoney(valor, moneda)}</strong>
      </p>
      <Table>
        <THead><TR><TH>Producto</TH><TH>Talla</TH><TH className="text-right">Pares</TH><TH className="text-right">Precio</TH></TR></THead>
        <TBody>
          {data.map((p) => (
            <TR key={p.variante_id}>
              <TD>{p.producto}<span className="block text-xs text-muted-foreground">{p.color}</span></TD>
              <TD className="tabular-nums">{p.talla}</TD>
              <TD className="text-right font-semibold tabular-nums">{p.en_poder}</TD>
              <TD className="text-right tabular-nums">{formatMoney(p.precio, moneda)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </>
  )
}

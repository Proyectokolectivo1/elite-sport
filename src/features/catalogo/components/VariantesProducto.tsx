import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useVariantes } from '../hooks/useCatalogo'

/** Solo lectura: el stock cambia únicamente por ingresos, ajustes y pedidos. */
export function VariantesProducto({ productoId }: { productoId: string }) {
  const { data = [], isLoading } = useVariantes(productoId)
  if (isLoading) return <Skeleton className="h-48 w-full" />

  const accion = (
    <Link to={`/admin/inventario?tab=ingreso&producto=${productoId}`} className={cn(buttonVariants({ variant: 'solid' }))}>
      Ingresar mercancía
    </Link>
  )
  if (data.length === 0) {
    return <EmptyState title="Sin existencias" description="Las tallas y colores aparecen al ingresar mercancía por caja o por unidad." action={accion} />
  }
  const total = data.reduce((s, v) => s + v.stock, 0)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Total en inventario: <strong className="text-foreground tabular-nums">{total}</strong> pares</p>
        {accion}
      </div>
      <Table>
        <THead>
          <TR>
            <TH>Color</TH>
            <TH>Talla</TH>
            <TH>SKU</TH>
            <TH className="text-right">Stock</TH>
          </TR>
        </THead>
        <TBody>
          {data.map((v) => (
            <TR key={v.id}>
              <TD>{v.color}</TD>
              <TD className="tabular-nums">{v.talla}</TD>
              <TD className="font-mono text-xs text-muted-foreground">{v.sku}</TD>
              <TD className="text-right tabular-nums">
                {v.stock === 0 ? <Badge variant="destructive">Agotado</Badge> : v.stock <= 3 ? <Badge variant="warning">{v.stock}</Badge> : v.stock}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  )
}

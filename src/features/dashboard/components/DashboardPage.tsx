import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { usePedidos } from '@/features/pedidos/hooks/usePedidos'
import { cn } from '@/lib/utils'
import { obtenerResumen } from '../api/dashboard'

function Dato({ to, etiqueta, valor, alerta }: { to: string; etiqueta: string; valor: number | undefined; alerta?: boolean }) {
  return (
    <Link to={to} className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground">
      <p className="eyebrow">{etiqueta}</p>
      {valor === undefined ? <Skeleton className="mt-3 h-12 w-16" /> : (
        <p className={cn('mt-2 font-display text-6xl font-extrabold leading-none tabular-nums', alerta && valor > 0 && 'text-warning')}>{valor}</p>
      )}
    </Link>
  )
}

export function DashboardPage() {
  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: obtenerResumen })
  const { data: pedidos = [] } = usePedidos()
  const moneda = useMoneyStore((s) => s.config)
  const nuevos = pedidos.filter((p) => p.estado === 'nuevo').slice(0, 5)

  return (
    <>
      <PageHeader title="Hoy en Elite Sport" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato to="/admin/pedidos" etiqueta="Pedidos nuevos" valor={data?.pedidosNuevos} alerta />
        <Dato to="/admin/mayoristas" etiqueta="Mayoristas por aprobar" valor={data?.mayoristasPendientes} alerta />
        <Dato to="/admin/inventario" etiqueta="Tallas con stock bajo" valor={data?.stockBajo} alerta />
        <Dato to="/admin/inventario" etiqueta="Tallas agotadas" valor={data?.agotadas} />
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-3xl">Pedidos por atender</h2>
        {nuevos.length === 0 ? <p className="text-sm text-muted-foreground">No hay pedidos nuevos.</p> : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {nuevos.map((p) => (
              <li key={p.id}>
                <Link to="/admin/pedidos" className="flex items-center justify-between gap-3 p-4 hover:bg-muted/50">
                  <span><strong className="tabular-nums">#{p.numero}</strong> · {p.cliente}<span className="block text-xs text-muted-foreground">{p.origen}</span></span>
                  <span className="flex items-center gap-3">
                    {p.tipo === 'lead_tienda' && <Badge>Lead</Badge>}
                    <span className="font-semibold tabular-nums">{formatMoney(p.total, moneda)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

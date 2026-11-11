import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { Price } from '@/components/ui/price'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useCentinela } from '@/lib/useCentinela'
import { useProductosPaginados } from '../hooks/useCatalogo'
import { GRUPOS } from '../schemas'

export function ProductosPage() {
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState('')
  const busqueda = useDeferredValue(q)
  const consulta = useProductosPaginados({ q: busqueda, grupo })
  const filtrados = useMemo(() => consulta.data?.pages.flatMap((p) => p.productos) ?? [], [consulta.data])
  const total = consulta.data?.pages[0]?.total ?? 0
  const { isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage } = consulta
  const centinela = useCentinela(() => void fetchNextPage(), !!hasNextPage && !isFetchingNextPage)

  return (
    <>
      <PageHeader
        title="Productos"
        description="Modelos, fotos por color y precios. El stock se maneja desde Inventario."
        actions={
          <Link to="/admin/productos/nuevo" className={cn(buttonVariants())}>
            <Plus /> Nuevo producto
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, marca o categoría" aria-label="Buscar productos" />
        <Select value={grupo} onChange={(e) => setGrupo(e.target.value)} aria-label="Filtrar por grupo">
          <option value="">Todos los grupos</option>
          {GRUPOS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}
      {error && <p role="alert" className="text-destructive">No se pudieron cargar los productos.</p>}
      {!isLoading && filtrados.length === 0 && (
        <EmptyState
          title={!busqueda && !grupo ? 'Aún no hay productos' : 'Sin resultados'}
          description={!busqueda && !grupo ? 'Crea el primero para empezar a vender.' : 'Prueba con otra búsqueda.'}
        />
      )}
      {filtrados.length > 0 && (
        <Table>
          <THead>
            <TR>
              <TH>Producto</TH>
              <TH>Grupo</TH>
              <TH className="text-right">PVP</TH>
              <TH className="text-right">Mayorista</TH>
              <TH className="text-right">Stock</TH>
              <TH>Estado</TH>
            </TR>
          </THead>
          <TBody>
            {filtrados.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link to={`/admin/productos/${p.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                    <span className="size-11 shrink-0 overflow-hidden rounded-sm bg-muted">
                      {p.imagen && <img src={p.imagen} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span>
                      {p.nombre}
                      <span className="block text-xs font-normal text-muted-foreground">{[p.marca, p.categoria].filter(Boolean).join(' · ')}</span>
                    </span>
                  </Link>
                </TD>
                <TD className="capitalize">{p.grupo === 'nino' ? 'niño' : p.grupo}</TD>
                <TD className="text-right"><Price amount={p.precio_publico} size="sm" /></TD>
                <TD className="text-right">{p.precio_mayorista === null ? <span className="text-muted-foreground">Sin precio</span> : <Price amount={p.precio_mayorista} size="sm" />}</TD>
                <TD className="text-right tabular-nums">{p.stock_total}</TD>
                <TD>
                  <div className="flex gap-1.5">
                    <Badge variant={p.activo ? 'success' : 'neutral'}>{p.activo ? 'Activo' : 'Oculto'}</Badge>
                    {p.destacado && <Badge variant="signal">Destacado</Badge>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {filtrados.length > 0 && (
        <div ref={centinela} className="mt-6 flex justify-center text-sm text-muted-foreground" aria-live="polite">
          {isFetchingNextPage ? 'Cargando más…' : hasNextPage ? `Mostrando ${filtrados.length} de ${total}` : `${total} ${total === 1 ? 'producto' : 'productos'}`}
        </div>
      )}
    </>
  )
}

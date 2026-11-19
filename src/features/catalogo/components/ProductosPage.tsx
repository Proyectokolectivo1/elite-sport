import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { Price } from '@/components/ui/price'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { FotoPar } from '@/features/bodega/components/FotoPar'
import { mensajeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { useCentinela } from '@/lib/useCentinela'
import { useEliminarProducto, useProductosPaginados } from '../hooks/useCatalogo'
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
  const eliminar = useEliminarProducto()
  const [aBorrar, setABorrar] = useState<{ id: string; nombre: string } | null>(null)

  function borrar() {
    if (!aBorrar) return
    eliminar.mutate(aBorrar.id, {
      onSuccess: () => setABorrar(null),
      onError: (e) => {
        setABorrar(null)
        toast.error(mensajeError(e))
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Productos"
        description="Modelos, fotos por color y precios. El stock se maneja desde Inventario."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/productos/importar" className={cn(buttonVariants({ variant: 'outline' }))}>
              <FileSpreadsheet /> Importar desde Excel
            </Link>
            <Link to="/admin/productos/nuevo" className={cn(buttonVariants())}>
              <Plus /> Nuevo producto
            </Link>
          </div>
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
              <TH><span className="sr-only">Acciones</span></TH>
            </TR>
          </THead>
          <TBody>
            {filtrados.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link to={`/admin/productos/${p.id}`} className="group flex items-center gap-4">
                    <FotoPar src={p.imagen} alt={p.nombre} className="size-24 rounded-xl sm:size-28" />
                    <span className="min-w-0">
                      <span className="block font-display text-xl font-bold uppercase leading-tight group-hover:underline">{p.nombre}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{[p.marca, p.categoria].filter(Boolean).join(' · ')}</span>
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
                <TD className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Eliminar ${p.nombre}`}
                    onClick={() => setABorrar({ id: p.id, nombre: p.nombre })}
                  >
                    <Trash2 />
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Dialog open={!!aBorrar} onOpenChange={(o) => { if (!o && !eliminar.isPending) setABorrar(null) }}>
        {aBorrar && (
          <DialogContent
            title={`Eliminar ${aBorrar.nombre}`}
            description="Sale de Productos, de la tienda y del inventario. Los pedidos que ya lo incluyen se conservan con sus datos. No se puede deshacer."
          >
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="ghost" />} disabled={eliminar.isPending}>Cancelar</DialogClose>
              <Button variant="destructive" disabled={eliminar.isPending} onClick={borrar}>{eliminar.isPending ? 'Eliminando…' : 'Eliminar'}</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {filtrados.length > 0 && (
        <div ref={centinela} className="mt-6 flex justify-center text-sm text-muted-foreground" aria-live="polite">
          {isFetchingNextPage ? 'Cargando más…' : hasNextPage ? `Mostrando ${filtrados.length} de ${total}` : `${total} ${total === 1 ? 'producto' : 'productos'}`}
        </div>
      )}
    </>
  )
}

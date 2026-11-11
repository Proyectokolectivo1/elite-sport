import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/select'
import { ProductCard } from '@/components/ui/product-card'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useOpciones, useTallas } from '@/features/catalogo/hooks/useCatalogo'
import { usePageMeta } from '@/lib/meta'
import { useCentinela } from '@/lib/useCentinela'
import { useStore } from '../context/StoreContext'
import { contarFiltros, filtrosAServidor, filtrosAUrl, filtrosDesdeUrl, type Filtros, type Orden } from '../filtros'
import { LOTE_CATALOGO, useProductosInfinitos } from '../hooks/useProductosTienda'
import { aTarjeta } from '../tarjeta'
import { FiltrosPanel } from './FiltrosPanel'

function EsqueletoTarjetas({ cantidad }: { cantidad: number }) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/5]" />
          <Skeleton className="mt-3 h-4 w-2/3" />
        </div>
      ))}
    </>
  )
}

export function CatalogoPage() {
  const { tienda, ruta, tiendaPrecios } = useStore()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => filtrosDesdeUrl(params), [params])
  usePageMeta(`Catálogo · ${tienda.nombre}`, `Calzado de ${tienda.nombre}. Filtra por talla, marca, estilo y precio.`)

  // Los productos se piden al servidor por lotes (con sus filtros) a medida que la persona baja.
  const consulta = useProductosInfinitos(tiendaPrecios, useMemo(() => filtrosAServidor(filtros), [filtros]))
  const productos = useMemo(() => consulta.data?.pages.flatMap((p) => p.productos) ?? [], [consulta.data])
  const total = consulta.data?.pages[0]?.total ?? 0
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = consulta
  const centinela = useCentinela(() => void fetchNextPage(), !!hasNextPage && !isFetchingNextPage)

  // Opciones de los filtros: listas pequeñas y cacheadas, independientes de cuántos productos haya.
  const { data: marcas = [] } = useOpciones('marcas')
  const { data: estilos = [] } = useOpciones('estilos')
  const { data: categorias = [] } = useOpciones('categorias')
  const { data: todasTallas = [] } = useTallas()
  const tallas = useMemo(() => {
    const delGrupo = filtros.grupo ? todasTallas.filter((t) => t.grupo === filtros.grupo) : todasTallas
    return [...new Map(delGrupo.map((t) => [t.etiqueta, t.orden])).entries()].sort((a, b) => a[1] - b[1]).map(([e]) => e)
  }, [todasTallas, filtros.grupo])

  function cambiar(f: Filtros) {
    setParams(filtrosAUrl(f), { replace: true })
  }

  const activos = contarFiltros(filtros)
  const panel = <FiltrosPanel opciones={{ marcas, estilos, categorias, tallas }} filtros={filtros} onChange={cambiar} />

  return (
    <div className="container-page py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{consulta.isLoading ? 'Cargando' : `${total} ${total === 1 ? 'producto' : 'productos'}`}</p>
          <h1 className="display-lg mt-1">{filtros.q ? `“${filtros.q}”` : 'Catálogo'}</h1>
          {filtros.q && (
            <button type="button" className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4" onClick={() => cambiar({ ...filtros, q: '' })}>
              <X className="size-3.5" /> Quitar búsqueda
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Ordenar" className="h-10 w-48" value={filtros.orden} onChange={(e) => cambiar({ ...filtros, orden: e.target.value as Orden })}>
            <option value="novedades">Novedades</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
            <option value="nombre">Nombre</option>
          </Select>
          <Sheet>
            <SheetTrigger render={<Button variant="outline" className="lg:hidden" />}>
              <SlidersHorizontal /> Filtros{activos > 0 ? ` (${activos})` : ''}
            </SheetTrigger>
            <SheetContent side="bottom" title="Filtros" footer={<SheetClose render={<Button className="w-full" />}>Ver {total} resultados</SheetClose>}>
              {panel}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filtros" className="hidden lg:block">
          <div className="sticky top-28">{panel}</div>
        </aside>
        <div>
          {consulta.isLoading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">
              <EsqueletoTarjetas cantidad={LOTE_CATALOGO / 2} />
            </div>
          ) : consulta.isError ? (
            <EmptyState title="No pudimos cargar el catálogo" description="Revisa tu conexión e inténtalo de nuevo." action={<Button variant="outline" onClick={() => void consulta.refetch()}>Reintentar</Button>} />
          ) : productos.length === 0 ? (
            <EmptyState
              title="No encontramos ese calzado"
              description="Prueba con otra talla o quita algún filtro."
              action={activos > 0 || filtros.q ? <Button variant="outline" onClick={() => cambiar({ ...filtros, grupo: '', marca: '', estilo: '', categoria: '', talla: '', min: null, max: null, q: '' })}>Limpiar filtros</Button> : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">
                {productos.map((p) => (
                  <ProductCard key={p.id} nivel={2} to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p)} />
                ))}
                {isFetchingNextPage && <EsqueletoTarjetas cantidad={3} />}
              </div>
              {/* Centinela del scroll infinito: al acercarse, se pide el siguiente lote. */}
              <div ref={centinela} className="mt-10 flex justify-center" aria-live="polite">
                {hasNextPage && !isFetchingNextPage && <Button variant="outline" onClick={() => void fetchNextPage()}>Mostrar más</Button>}
                {!hasNextPage && productos.length > LOTE_CATALOGO && <p className="text-sm text-muted-foreground">Viste los {total} productos.</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

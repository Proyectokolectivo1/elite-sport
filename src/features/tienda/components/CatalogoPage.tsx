import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ProductCard } from '@/components/ui/product-card'
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { usePageMeta } from '@/lib/meta'
import { useStore } from '../context/StoreContext'
import { contarFiltros, filtrarProductos, filtrosAUrl, filtrosDesdeUrl, type Filtros, type Orden } from '../filtros'
import { aTarjeta } from '../tarjeta'
import { FiltrosPanel } from './FiltrosPanel'

const PAGINA = 12

export function CatalogoPage() {
  const { tienda, productos, precio, ruta, cargando } = useStore()
  const [params, setParams] = useSearchParams()
  const filtros = useMemo(() => filtrosDesdeUrl(params), [params])
  usePageMeta(`Catálogo · ${tienda.nombre}`, `Calzado de ${tienda.nombre}. Filtra por talla, marca, estilo y precio.`)

  const resultados = useMemo(() => filtrarProductos(productos, filtros, precio), [productos, filtros, precio])
  const firma = params.toString()
  // Al cambiar los filtros se vuelve a la primera página.
  const [pagina, setPagina] = useState({ firma, n: PAGINA })
  const visibles = pagina.firma === firma ? pagina.n : PAGINA
  const centinela = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = centinela.current
    if (!el || visibles >= resultados.length) return
    const obs = new IntersectionObserver((e) => e[0].isIntersecting && setPagina((p) => ({ firma, n: (p.firma === firma ? p.n : PAGINA) + PAGINA })), { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [visibles, resultados.length, firma])

  function cambiar(f: Filtros) {
    setParams(filtrosAUrl(f), { replace: true })
  }

  const activos = contarFiltros(filtros)
  const panel = <FiltrosPanel productos={productos} filtros={filtros} onChange={cambiar} />

  return (
    <div className="container-page py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{resultados.length} {resultados.length === 1 ? 'producto' : 'productos'}</p>
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
            <SheetContent side="bottom" title="Filtros" footer={<SheetClose render={<Button className="w-full" />}>Ver {resultados.length} resultados</SheetClose>}>
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
          {cargando ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i}><Skeleton className="aspect-[4/5]" /><Skeleton className="mt-3 h-4 w-2/3" /></div>
              ))}
            </div>
          ) : resultados.length === 0 ? (
            <EmptyState
              title="No encontramos ese calzado"
              description="Prueba con otra talla o quita algún filtro."
              action={activos > 0 || filtros.q ? <Button variant="outline" onClick={() => cambiar({ ...filtros, grupo: '', marca: '', estilo: '', categoria: '', talla: '', min: null, max: null, q: '' })}>Limpiar filtros</Button> : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6">
                {resultados.slice(0, visibles).map((p) => (
                  <ProductCard key={p.id} nivel={2} to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p, precio(p))} />
                ))}
              </div>
              {visibles < resultados.length && (
                <div ref={centinela} className="mt-10 flex justify-center">
                  <Button variant="outline" onClick={() => setPagina({ firma, n: visibles + PAGINA })}>Mostrar más</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

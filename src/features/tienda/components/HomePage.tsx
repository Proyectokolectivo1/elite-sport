import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ProductCard } from '@/components/ui/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageMeta } from '@/lib/meta'
import { cn } from '@/lib/utils'
import { useStore } from '../context/StoreContext'
import { useProductosPagina } from '../hooks/useProductosTienda'
import { aTarjeta } from '../tarjeta'
import { CategoriasGrupo } from './CategoriasGrupo'

export function HomePage() {
  const { tienda, ruta, ciudad, tiendaPrecios } = useStore()
  usePageMeta(`${tienda.nombre} · Calzado deportivo y urbano en ${ciudad}`, `Catálogo de ${tienda.nombre}: calzado para dama, caballero y niño. Elige tu talla y haz tu pedido por WhatsApp.`)

  // Solo se piden los pocos productos que se ven en la portada, no todo el catálogo.
  const destacadosQ = useProductosPagina('destacados', tiendaPrecios, { destacado: true }, 5)
  const novedadesQ = useProductosPagina('novedades', tiendaPrecios, { orden: 'novedades' }, 8)
  const destacados = destacadosQ.data?.productos ?? []
  const novedades = novedadesQ.data?.productos ?? []
  const cargando = novedadesQ.isLoading
  // La tarjeta grande solo se usa cuando completa la grilla (1 grande + 4 normales); si no, queda un hueco.
  const conGrande = destacados.length === 5

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand text-brand-foreground">
        {tienda.banner_url && (
          <>
            <img src={tienda.banner_url} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-45" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-brand/55" />
          </>
        )}
        <div className="container-page flex min-h-[26rem] flex-col justify-end gap-8 py-14 md:min-h-[34rem] md:py-20">
          <h1 className="display-xl max-w-4xl">Hecho para moverte</h1>
          <p className="max-w-md text-current/80">Calzado deportivo y urbano para dama, caballero y niño. Elige tu talla y pide por WhatsApp.</p>
          <div className="flex flex-wrap gap-3">
            <Link to={ruta('/catalogo')} className={cn(buttonVariants({ size: 'lg' }))}>Ver catálogo</Link>
            <Link to={ruta('/catalogo?orden=novedades')} className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'border-current/40 text-current hover:bg-white/10')}>Novedades</Link>
          </div>
        </div>
      </section>

      <CategoriasGrupo />

      {destacados.length > 0 && (
        <section className="container-page py-6">
          <h2 className="display-lg mb-6">Destacados</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {destacados.map((p, i) => (
              <div key={p.id} className={conGrande && i === 0 ? 'col-span-2 md:row-span-2' : undefined}>
                <ProductCard to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p)} destacada={conGrande && i === 0} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="container-page pb-16 pt-4">
        <h2 className="display-lg mb-6">Novedades</h2>
        {cargando ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i}><Skeleton className="aspect-[4/5]" /><Skeleton className="mt-3 h-4 w-2/3" /></div>
            ))}
          </div>
        ) : novedades.length === 0 ? (
          <EmptyState title="Pronto tendremos productos" description="Estamos preparando el catálogo. Vuelve en unos días." />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {novedades.map((p) => (
              <ProductCard key={p.id} to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p)} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

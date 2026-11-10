import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ProductCard } from '@/components/ui/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageMeta } from '@/lib/meta'
import { cn } from '@/lib/utils'
import { useStore } from '../context/StoreContext'
import { aTarjeta } from '../tarjeta'

const GRUPOS = [
  { id: 'dama', titulo: 'Dama', texto: 'Tallas 34 a 40' },
  { id: 'caballero', titulo: 'Caballero', texto: 'Tallas 38 a 45' },
  { id: 'nino', titulo: 'Niño', texto: 'Tallas 22 a 33' },
]

export function HomePage() {
  const { tienda, productos, precio, ruta, ciudad, cargando } = useStore()
  usePageMeta(`${tienda.nombre} · Calzado deportivo y urbano en ${ciudad}`, `Catálogo de ${tienda.nombre}: calzado para dama, caballero y niño. Elige tu talla y haz tu pedido por WhatsApp.`)

  const destacados = productos.filter((p) => p.destacado).slice(0, 5)
  // La tarjeta grande solo se usa cuando completa la grilla (1 grande + 4 normales); si no, queda un hueco.
  const conGrande = destacados.length === 5
  const novedades = productos.slice(0, 8)
  const marcas = [...new Map(productos.flatMap((p) => (p.marca ? [[p.marca.id, p.marca] as const] : []))).values()]

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

      <section aria-label="Categorías por grupo" className="container-page grid gap-3 py-10 sm:grid-cols-3">
        {GRUPOS.map((g) => (
          <Link key={g.id} to={ruta(`/catalogo?g=${g.id}`)} className="group flex h-36 flex-col justify-between rounded-md border border-border bg-card p-5 transition-colors hover:border-foreground md:h-44">
            <span className="eyebrow">{g.texto}</span>
            <span className="flex items-end justify-between">
              <span className="font-display text-5xl font-extrabold uppercase leading-none">{g.titulo}</span>
            </span>
          </Link>
        ))}
      </section>

      {destacados.length > 0 && (
        <section className="container-page py-6">
          <h2 className="display-lg mb-6">Destacados</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {destacados.map((p, i) => (
              <div key={p.id} className={conGrande && i === 0 ? 'col-span-2 md:row-span-2' : undefined}>
                <ProductCard to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p, precio(p))} destacada={conGrande && i === 0} />
              </div>
            ))}
          </div>
        </section>
      )}

      {marcas.length > 0 && (
        <section aria-label="Marcas" className="container-page py-10">
          <ul className="flex flex-wrap gap-x-8 gap-y-2 border-y border-border py-5">
            {marcas.map((m) => (
              <li key={m.id}>
                <Link to={ruta(`/catalogo?marca=${m.id}`)} className="font-display text-3xl font-bold uppercase text-muted-foreground transition-colors hover:text-foreground">{m.nombre}</Link>
              </li>
            ))}
          </ul>
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
        ) : productos.length === 0 ? (
          <EmptyState title="Pronto tendremos productos" description="Estamos preparando el catálogo. Vuelve en unos días." />
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {novedades.map((p) => (
              <ProductCard key={p.id} to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p, precio(p))} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}

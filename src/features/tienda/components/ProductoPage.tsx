import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Price } from '@/components/ui/price'
import { ProductCard } from '@/components/ui/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { SizeSelector, type TallaOpcion } from '@/components/ui/size-selector'
import { usePageMeta } from '@/lib/meta'
import { cn } from '@/lib/utils'
import { useCarritoStore } from '../carrito/carritoStore'
import { useProductoPorSlug, useProductosPagina } from '../hooks/useProductosTienda'
import { useStore } from '../context/StoreContext'
import { aTarjeta } from '../tarjeta'

export function ProductoPage() {
  const { productoSlug } = useParams()
  return <ProductoVista key={productoSlug} slug={productoSlug} />
}

function ProductoVista({ slug: productoSlug }: { slug: string | undefined }) {
  const { ruta, clave, setCarritoAbierto, tienda, tiendaPrecios } = useStore()
  // Solo se pide este producto (no todo el catálogo), con su precio en la tienda activa.
  const { data: producto, isLoading: cargando } = useProductoPorSlug(productoSlug, tiendaPrecios)
  const { data: relacionadosQ } = useProductosPagina(
    `relacionados-${producto?.id}`,
    tiendaPrecios,
    producto?.categoria ? { categoria: producto.categoria.id } : { grupo: producto?.grupo },
    5,
    !!producto,
  )

  const colores = useMemo(() => {
    if (!producto) return []
    const orden = [...producto.variantes.map((v) => v.color), ...producto.imagenes.map((i) => i.color)]
    return [...new Set(orden)]
  }, [producto])

  const [elegido, setColor] = useState<string | null>(null)
  const color = elegido ?? colores[0] ?? ''
  const [tallaId, setTallaId] = useState<string | null>(null)
  const [foto, setFoto] = useState(0)

  usePageMeta(producto ? `${producto.nombre} · ${tienda.nombre}` : `Producto · ${tienda.nombre}`, producto?.descripcion ?? undefined)

  if (!producto && cargando) {
    return (
      <div className="container-page py-8 md:py-12">
        <Skeleton className="mb-6 h-5 w-40" />
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-14">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="space-y-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-16 w-3/4" /><Skeleton className="h-10 w-32" /><Skeleton className="h-40 w-full" /></div>
        </div>
      </div>
    )
  }
  if (!producto) {
    return (
      <div className="container-page py-16">
        <EmptyState title="Este modelo ya no está disponible" description="Mira el resto del catálogo." action={<Link to={ruta('/catalogo')} className="underline underline-offset-4">Ir al catálogo</Link>} />
      </div>
    )
  }

  const pr = producto.precio
  const fotosColor = producto.imagenes.filter((i) => i.color === color)
  const fotos = fotosColor.length > 0 ? fotosColor : producto.imagenes
  const variantesColor = producto.variantes.filter((v) => v.color === color)
  const tallas: TallaOpcion[] = variantesColor.map((v) => ({ id: v.id, etiqueta: v.talla, stock: v.stock }))
  const variante = variantesColor.find((v) => v.id === tallaId)
  const stockColor = (c: string) => producto.variantes.filter((v) => v.color === c).reduce((s, v) => s + v.stock, 0)

  function agregar() {
    if (!variante || !producto) return
    useCarritoStore.getState().agregar(clave, {
      varianteId: variante.id,
      productoId: producto.id,
      nombre: producto.nombre,
      color: variante.color,
      talla: variante.talla,
      imagen: fotos[0]?.miniatura ?? fotos[0]?.url ?? null,
      precio: pr,
      stock: variante.stock,
    })
    setCarritoAbierto(true)
  }

  const relacionados = (relacionadosQ?.productos ?? []).filter((p) => p.id !== producto.id).slice(0, 4)

  return (
    <div className="container-page py-8 md:py-12">
      <nav aria-label="Ruta" className="mb-6 text-sm text-muted-foreground">
        <Link to={ruta('/catalogo')} className="underline-offset-4 hover:underline">Catálogo</Link> / {producto.nombre}
      </nav>

      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:gap-14">
        <div>
          <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
            {fotos[foto] ? <img src={fotos[foto].url} alt={`${producto.nombre}, ${color}`} width={800} height={1000} decoding="async" fetchPriority="high" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-sm text-muted-foreground">Foto próximamente</div>}
          </div>
          {fotos.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {fotos.map((f, i) => (
                <li key={f.url}>
                  <button type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={foto === i} onClick={() => setFoto(i)} className={cn('block aspect-square w-full overflow-hidden rounded-md border-2', foto === i ? 'border-foreground' : 'border-transparent opacity-70 hover:opacity-100')}>
                    <img src={f.miniatura ?? f.url} alt="" width={160} height={160} decoding="async" className="size-full object-cover" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:sticky md:top-28 md:self-start">
          {producto.marca && <p className="eyebrow">{producto.marca.nombre}</p>}
          <h1 className="mt-1 text-5xl md:text-6xl">{producto.nombre}</h1>
          <Price amount={pr} size="lg" className="mt-4" />
          {producto.descripcion && <p className="mt-5 text-muted-foreground">{producto.descripcion}</p>}

          {colores.length > 1 && (
            <fieldset className="mt-7">
              <legend className="eyebrow mb-2">Color: <span className="text-foreground">{color}</span></legend>
              <div className="flex flex-wrap gap-2">
                {colores.map((c) => (
                  <button key={c} type="button" aria-pressed={color === c} disabled={stockColor(c) === 0 && producto.variantes.length > 0} onClick={() => { setColor(c); setTallaId(null); setFoto(0) }} className={cn('h-10 rounded-md border px-4 text-sm font-semibold transition-colors disabled:opacity-40', color === c ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground')}>
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-7">
            <p className="eyebrow mb-2">Talla</p>
            {tallas.length > 0 ? (
              <SizeSelector tallas={tallas} value={tallaId} onChange={setTallaId} />
            ) : (
              <p className="text-sm text-muted-foreground">Sin stock por ahora. Escríbenos y te avisamos cuando llegue.</p>
            )}
          </div>

          <Button size="lg" className="mt-8 w-full" disabled={!variante} onClick={agregar}>
            {variante ? 'Agregar al carrito' : 'Elige una talla'}
          </Button>
          {variante && variante.stock <= 3 && <p className="mt-2 text-sm text-warning">Quedan solo {variante.stock} pares en esta talla.</p>}
        </div>
      </div>

      {relacionados.length > 0 && (
        <section className="mt-16">
          <h2 className="display-lg mb-6">También te puede gustar</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
            {relacionados.map((p) => <ProductCard key={p.id} to={ruta(`/producto/${p.slug}`)} producto={aTarjeta(p)} />)}
          </div>
        </section>
      )}
    </div>
  )
}

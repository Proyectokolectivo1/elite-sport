import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GrupoTalla } from '../api/tienda'
import { useStore } from '../context/StoreContext'
import { useProductosPagina } from '../hooks/useProductosTienda'

const GRUPOS: { id: GrupoTalla; titulo: string; tallas: string; inicial: string }[] = [
  { id: 'dama', titulo: 'Dama', tallas: 'Tallas 34 a 40', inicial: '34' },
  { id: 'caballero', titulo: 'Caballero', tallas: 'Tallas 38 a 45', inicial: '38' },
  { id: 'nino', titulo: 'Niño', tallas: 'Tallas 22 a 33', inicial: '22' },
]

function Tarjeta({ grupo }: { grupo: (typeof GRUPOS)[number] }) {
  const { ruta, tiendaPrecios } = useStore()
  // Una sola consulta pequeña por grupo: trae cuántos modelos hay y la foto del más reciente.
  const { data, isLoading } = useProductosPagina(`grupo-${grupo.id}`, tiendaPrecios, { grupo: grupo.id }, 1)
  const total = data?.total ?? 0
  const foto = data?.productos[0]?.imagenes[0]
  const imagen = foto ? (foto.miniatura ?? foto.url) : null

  return (
    <Link
      to={ruta(`/catalogo?g=${grupo.id}`)}
      className={cn(
        // Celular: tarjeta compacta y apaisada; desde tablet vuelve a la tarjeta alta de tres columnas.
        'group relative isolate flex aspect-[16/11] min-w-[62%] snap-start flex-col justify-end overflow-hidden rounded-xl border border-border bg-card p-4 outline-none sm:min-w-[42%] md:aspect-[4/5] md:min-w-0 md:rounded-2xl md:p-6',
        'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
      )}
    >
      {imagen ? (
        <>
          <img src={imagen} alt="" loading="lazy" decoding="async" width={400} height={500} className="absolute inset-0 -z-10 size-full object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] group-hover:scale-105" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </>
      ) : (
        // Sin foto todavía: una cifra gigante y tenue (puro adorno, va en un pseudo-elemento para no ser texto).
        <span
          aria-hidden
          data-inicial={grupo.inicial}
          className={cn(
            "absolute -right-2 -top-4 -z-10 select-none font-display text-[7rem] font-extrabold leading-none md:text-[11rem] text-foreground/[0.07] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] before:content-[attr(data-inicial)] group-hover:-translate-x-2",
            isLoading && 'animate-pulse',
          )}
        />
      )}

      <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-full md:right-4 md:top-4 md:size-12 bg-signal text-signal-foreground transition-transform duration-[var(--dur-base)] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
        <ArrowUpRight aria-hidden className="size-4 md:size-5" />
      </span>

      <div className={cn(imagen ? 'text-white' : 'text-foreground')}>
        <p className={cn('text-xs md:text-sm', imagen ? 'text-white/75' : 'text-muted-foreground')}>
          {isLoading ? grupo.tallas : `${total} ${total === 1 ? 'modelo' : 'modelos'} · ${grupo.tallas}`}
        </p>
        <h3 className="mt-1 font-display text-3xl font-extrabold uppercase leading-[0.9] md:mt-1.5 md:text-6xl">{grupo.titulo}</h3>
        <span className="mt-2.5 inline-block border-b-2 border-signal pb-0.5 text-[0.6875rem] md:mt-4 md:text-[0.8125rem] font-semibold uppercase tracking-[0.1em]">Ver colección</span>
      </div>
    </Link>
  )
}

/** Entrada por categoría: tarjetas altas con la foto del grupo (o una cifra de talla si aún no hay fotos). */
export function CategoriasGrupo() {
  return (
    <section aria-label="Comprar por categoría" className="container-page py-8 md:py-12">
      <h2 className="display-lg mb-4 md:mb-6">Compra por categoría</h2>
      {/* En celular se desliza de lado; desde tablet son tres columnas. */}
      <div className="-mx-[var(--gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--gutter)] pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0 scroll-pl-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {GRUPOS.map((g) => (
          <Tarjeta key={g.id} grupo={g} />
        ))}
      </div>
    </section>
  )
}

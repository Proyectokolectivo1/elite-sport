import { memo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Price } from '@/components/ui/price'
import { cn } from '@/lib/utils'

export interface ProductCardData {
  nombre: string
  marca?: string | null
  imagenUrl?: string | null
  precio: number
  precioAnterior?: number
  /** Texto corto de disponibilidad, ej. "Tallas 35 a 39". */
  tallas?: string
  agotado?: boolean
  destacado?: boolean
  /** Colores disponibles (hex o nombre CSS) para mostrar puntos. */
  colores?: string[]
}

interface Props {
  producto: ProductCardData
  to: string
  /** Hace la tarjeta más alta; útil para la grilla asimétrica. */
  destacada?: boolean
  className?: string
  footer?: ReactNode
  /** Nivel del título de la tarjeta (h2 si la página solo tiene un h1 encima). */
  nivel?: 2 | 3
}

/** Producto sin foto: un bloque liso con el texto, sin dibujos. */
function SinImagen() {
  return <div className="grid size-full place-items-center bg-muted text-sm text-muted-foreground">Sin foto</div>
}

/** Tarjeta de producto: la foto manda, el texto acompaña. */
export const ProductCard = memo(function ProductCard({ producto, to, destacada, className, footer, nivel = 3 }: Props) {
  const Titulo = nivel === 2 ? 'h2' : 'h3'
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex flex-col [contain-intrinsic-size:auto_420px] [content-visibility:auto] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
        className,
      )}
    >
      <div className={cn('relative overflow-hidden rounded-md bg-muted', destacada ? 'aspect-[4/5] sm:aspect-[3/4]' : 'aspect-[4/5]')}>
        {producto.imagenUrl ? (
          <img
            src={producto.imagenUrl}
            alt={producto.nombre}
            loading="lazy"
            decoding="async"
            width={400}
            height={500}
            className="size-full object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] group-hover:scale-[1.04]"
          />
        ) : (
          <SinImagen />
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
          {producto.destacado && <Badge variant="signal">Destacado</Badge>}
          {producto.agotado && <Badge variant="neutral">Agotado</Badge>}
        </div>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {producto.marca && <p className="eyebrow">{producto.marca}</p>}
          <Titulo className="mt-1 truncate font-sans text-[0.9375rem] font-semibold normal-case leading-snug tracking-normal">
            {producto.nombre}
          </Titulo>
          {producto.tallas && <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{producto.tallas}</p>}
        </div>
        <Price amount={producto.precio} compareAt={producto.precioAnterior} size="sm" className="shrink-0" />
      </div>
      {producto.colores && producto.colores.length > 0 && (
        <ul className="mt-2 flex gap-1.5" aria-label="Colores disponibles">
          {producto.colores.map((c) => (
            <li key={c} className="size-3.5 rounded-full border border-foreground/25" style={{ backgroundColor: c }} title={c} />
          ))}
        </ul>
      )}
      {footer}
    </Link>
  )
})

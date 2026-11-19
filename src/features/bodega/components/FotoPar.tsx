import { Footprints } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Foto del par (cuadrada). Sin foto, un recuadro neutro: nunca deja un hueco. */
export function FotoPar({ src, alt = '', className }: { src?: string | null; alt?: string; className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted', className)}>
      {src ? <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" /> : <Footprints aria-hidden className="size-1/3 text-muted-foreground" />}
    </span>
  )
}

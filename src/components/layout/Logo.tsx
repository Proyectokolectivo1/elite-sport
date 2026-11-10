import { cn } from '@/lib/utils'

interface Props {
  nombre: string
  logoUrl?: string | null
  className?: string
}

/** Logo de la tienda; si no subió uno, un wordmark tipográfico con trazo de acento. */
export function Logo({ nombre, logoUrl, className }: Props) {
  if (logoUrl) {
    return <img src={logoUrl} alt={nombre} className={cn('h-8 w-auto max-w-[9rem] object-contain', className)} />
  }
  const [primera, ...resto] = nombre.trim().split(/\s+/)
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 font-display text-2xl font-extrabold uppercase leading-none tracking-wide', className)}>
      <span>{primera}</span>{' '}
      {resto.length > 0 && <span className="font-semibold text-current/70">{resto.join(' ')}</span>}
      <span aria-hidden className="-skew-x-[18deg] self-center h-[0.7em] w-[0.28em] bg-signal" />
    </span>
  )
}

import { useFormatMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

interface Props {
  amount: number
  /** Precio anterior (tachado). */
  compareAt?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' } as const

/** Precio en la moneda configurada por el admin. Usa siempre este componente para mostrar dinero. */
export function Price({ amount, compareAt, size = 'md', className }: Props) {
  const fmt = useFormatMoney()
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-display font-bold tabular-nums leading-none', sizes[size], className)}>
      <span>{fmt(amount)}</span>
      {compareAt !== undefined && compareAt > amount && (
        <s className="font-sans text-[0.8125rem] font-medium text-muted-foreground">{fmt(compareAt)}</s>
      )}
    </span>
  )
}

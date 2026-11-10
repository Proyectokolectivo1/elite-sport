import { cn } from '@/lib/utils'

interface Props<T extends string> {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
}

/** Pestañas simples, con scroll horizontal en móvil. El contenido lo pinta quien las usa. */
export function Tabs<T extends string>({ tabs, value, onChange, className }: Props<T>) {
  return (
    <div role="tablist" className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px shrink-0 border-b-2 px-4 py-3 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] transition-colors',
            value === t.id ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

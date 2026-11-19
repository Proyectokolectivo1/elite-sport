import { cn } from '@/lib/utils'

export interface TallaOpcion {
  id: string
  etiqueta: string
  /** Si hay pares de esta talla. El número exacto solo lo ve el personal de bodega. */
  disponible: boolean
}

interface Props {
  tallas: TallaOpcion[]
  value: string | null
  onChange: (id: string) => void
  /** Si es false, solo muestra disponibilidad (sin seleccionar). */
  selectable?: boolean
  label?: string
}

/** Selector de talla: disponible / agotada. Agotada no se puede elegir. */
export function SizeSelector({ tallas, value, onChange, selectable = true, label = 'Talla' }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {tallas.map((t) => {
        const agotada = !t.disponible
        const activa = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={activa}
            aria-disabled={agotada || !selectable}
            disabled={agotada || !selectable}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative h-12 rounded-md border text-[0.9375rem] font-semibold tabular-nums transition-[background-color,color,border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              activa
                ? 'border-foreground bg-foreground text-background'
                : 'border-input bg-card text-foreground hover:border-foreground',
              agotada &&
                'cursor-not-allowed border-border bg-transparent text-muted-foreground line-through decoration-1 hover:border-border',
            )}
          >
            {t.etiqueta}
            <span className="sr-only">
              {agotada ? ', agotada' : ', disponible'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

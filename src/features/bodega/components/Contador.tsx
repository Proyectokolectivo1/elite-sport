import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  etiqueta: string
  /** Texto accesible del campo, ej. "Vendidos de Adidas runner talla 40". */
  ariaLabel: string
  valor: number
  min: number
  max: number
  onChange: (n: number) => void
  invalido?: boolean
}

/**
 * Cantidad con botones − / + y campo editable. El campo se puede vaciar mientras se escribe (no se queda
 * en 0) y al enfocarlo se selecciona todo, así escribir "1" reemplaza el valor en vez de dejar "10".
 */
export function Contador({ etiqueta, ariaLabel, valor, min, max, onChange, invalido }: Props) {
  const [texto, setTexto] = useState(String(valor))
  useEffect(() => setTexto(String(valor)), [valor])

  const aplicar = (n: number) => onChange(Math.max(min, Math.min(max, n)))

  return (
    <div className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {etiqueta}
      <div className={cn('mt-1 flex items-center rounded-lg border border-input', invalido && 'border-destructive', min === max && 'opacity-60')}>
        <Button type="button" variant="ghost" size="icon" aria-label={`Menos: ${ariaLabel}`} disabled={valor <= min} onClick={() => aplicar(valor - 1)}>
          <Minus />
        </Button>
        <input
          aria-label={ariaLabel}
          inputMode="numeric"
          pattern="[0-9]*"
          className="h-11 w-14 bg-transparent text-center text-lg font-bold tabular-nums text-foreground outline-none"
          value={texto}
          disabled={min === max}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const limpio = e.target.value.replace(/\D/g, '').slice(0, 4)
            setTexto(limpio)
            if (limpio !== '') aplicar(Number(limpio))
          }}
          onBlur={() => setTexto(String(valor))}
        />
        <Button type="button" variant="ghost" size="icon" aria-label={`Más: ${ariaLabel}`} disabled={valor >= max} onClick={() => aplicar(valor + 1)}>
          <Plus />
        </Button>
      </div>
    </div>
  )
}

import { Store } from 'lucide-react'
import { textoPieza } from '../logica'
import type { Pieza } from '../schemas'

/** Aviso para bodega: la línea es de exhibición y dice de qué local sale cada pieza, para no buscarla en bodega. */
export function AvisoExhibicion({ piezas }: { piezas?: { pieza: Pieza; local: string }[] }) {
  if (!piezas || piezas.length === 0) return null
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
      <Store aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>
        <strong>Es de exhibición, no está en bodega.</strong> Retírala: {piezas.map((p) => textoPieza(p.pieza, p.local)).join(' + ')}.
      </span>
    </p>
  )
}

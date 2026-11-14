import { create } from 'zustand'
import { X } from 'lucide-react'

interface AvisoItem {
  id: number
  message: string
}

interface AvisoState {
  items: AvisoItem[]
  push: (message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

const useAvisoStore = create<AvisoState>((set) => ({
  items: [],
  // El mismo mensaje no se repite: un error que se reintenta no apila franjas.
  push: (message) => set((s) => (s.items.some((i) => i.message === message) ? s : { items: [...s.items, { id: nextId++, message }] })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

/**
 * Avisos de la interfaz. No hay ventanas emergentes:
 * - `success` y `show` no muestran nada: el resultado ya se ve en la pantalla (listas, saldos y estados se actualizan).
 * - `error` se muestra en una franja fija dentro de la página, que se cierra a mano, para que un fallo nunca pase en silencio.
 */
export const toast = {
  show: (message: string) => {
    void message
  },
  success: (message: string) => {
    void message
  },
  error: (message: string) => useAvisoStore.getState().push(message),
}

/** Franja de errores. Va en el flujo de la página (no flota sobre el contenido). Se monta una vez por diseño. */
export function Toaster() {
  const items = useAvisoStore((s) => s.items)
  const dismiss = useAvisoStore((s) => s.dismiss)
  if (items.length === 0) return null
  return (
    <div role="region" aria-label="Avisos" className="border-b border-destructive/40 bg-destructive/10">
      {items.map((t) => (
        <div key={t.id} role="alert" className="mx-auto flex max-w-[var(--container-max,80rem)] items-start gap-3 px-[var(--gutter)] py-2.5 text-sm">
          <p className="flex-1">{t.message}</p>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => dismiss(t.id)}
            className="grid size-6 shrink-0 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

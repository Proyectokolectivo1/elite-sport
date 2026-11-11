import { create } from 'zustand'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'neutral' | 'success' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastState {
  items: ToastItem[]
  push: (message: string, tone?: ToastTone) => void
  dismiss: (id: number) => void
}

let nextId = 1

const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (message, tone = 'neutral') => {
    const id = nextId++
    set((s) => ({ items: [...s.items, { id, message, tone }] }))
    setTimeout(() => get().dismiss(id), 4500)
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}))

/** API imperativa: `toast.success('Guardado')`. Se puede llamar fuera de componentes. */
export const toast = {
  show: (message: string) => useToastStore.getState().push(message, 'neutral'),
  success: (message: string) => useToastStore.getState().push(message, 'success'),
  error: (message: string) => useToastStore.getState().push(message, 'error'),
}

const bar: Record<ToastTone, string> = {
  neutral: 'bg-foreground',
  success: 'bg-success',
  error: 'bg-destructive',
}

/** Monta una sola vez, cerca de la raíz de la app. */
export function Toaster() {
  const items = useToastStore((s) => s.items)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div
      role="region"
      aria-label="Notificaciones"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-4 pt-20 sm:items-end"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="pointer-events-auto flex w-full max-w-sm items-stretch overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span aria-hidden className={cn('w-1 shrink-0', bar[t.tone])} />
          <p className="flex-1 px-3.5 py-3 text-sm">{t.message}</p>
          <button
            type="button"
            aria-label="Cerrar notificación"
            onClick={() => dismiss(t.id)}
            className="grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

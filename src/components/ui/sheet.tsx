import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close

type Side = 'right' | 'left' | 'bottom'

const sideClasses: Record<Side, string> = {
  right:
    'inset-y-0 right-0 h-full w-full max-w-md border-l data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full',
  left: 'inset-y-0 left-0 h-full w-full max-w-sm border-r data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full',
  bottom:
    'inset-x-0 bottom-0 max-h-[88dvh] w-full rounded-t-2xl border-t data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full',
}

interface ContentProps {
  title: string
  description?: string
  /** `bottom` es la hoja inferior para móvil (filtros, carrito). */
  side?: Side
  children: ReactNode
  footer?: ReactNode
  className?: string
}

function SheetContent({ title, description, side = 'right', children, footer, className }: ContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-opacity duration-[var(--dur-base)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
      <DialogPrimitive.Popup
        className={cn(
          'fixed z-50 flex flex-col border-border bg-popover text-popover-foreground shadow-lg outline-none transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)]',
          sideClasses[side],
          className,
        )}
      >
        {side === 'bottom' && <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-foreground/20" />}
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <DialogPrimitive.Title className="font-display text-3xl font-bold uppercase leading-none">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Cerrar"
            className="-mr-2 grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-border px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent }

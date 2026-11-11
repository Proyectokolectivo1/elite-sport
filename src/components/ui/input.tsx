import { forwardRef, useState, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const campo =
  'w-full rounded-md border border-input bg-card px-3.5 text-[0.9375rem] text-foreground placeholder:text-muted-foreground/80 transition-colors duration-[var(--dur-base)] outline-none focus-visible:border-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cn(campo, 'h-11', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(campo, 'min-h-24 py-2.5', className)} {...props} />
})

interface SugerenciasProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  value: string
  onChange: (valor: string) => void
  opciones: string[]
}

/** Campo de texto con sugerencias propias (la lista nativa de <datalist> usa la fuente y los bordes del sistema). */
export function InputSugerencias({ value, onChange, opciones, className, ...props }: SugerenciasProps) {
  const [abierto, setAbierto] = useState(false)
  const filtradas = opciones.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase()) && o !== value)
  return (
    <div className="relative">
      <input
        {...props}
        role="combobox"
        aria-expanded={abierto && filtradas.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}
        className={cn(campo, 'h-11', className)}
      />
      {abierto && filtradas.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-full z-[70] mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 font-sans text-popover-foreground shadow-lg">
          {filtradas.map((o) => (
            <li key={o} role="option" aria-selected={false}>
              <button
                type="button"
                tabIndex={-1}
                className="flex h-10 w-full items-center rounded-lg px-3 text-left text-[0.9375rem] hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(o)
                  setAbierto(false)
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('eyebrow mb-1.5 block text-foreground/80', className)} {...props} />
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return (
    <p role="alert" className="mt-1.5 text-[0.8125rem] text-destructive">
      {children}
    </p>
  )
}

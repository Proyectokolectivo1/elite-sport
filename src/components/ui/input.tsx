import { Children, forwardRef, isValidElement, useRef, useState, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const campo =
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

interface OpcionSelect {
  value: string
  label: ReactNode
  disabled?: boolean
}

function leerOpciones(children: ReactNode): OpcionSelect[] {
  return Children.toArray(children).flatMap((c) => {
    if (!isValidElement(c) || c.type !== 'option') return []
    const p = c.props as { value?: string | number; children?: ReactNode; disabled?: boolean }
    return [{ value: String(p.value ?? (typeof p.children === 'string' ? p.children : '')), label: p.children, disabled: p.disabled }]
  })
}

/**
 * Lista desplegable con la tipografía y los bordes de la tienda (la lista nativa del navegador usa la fuente
 * del sistema). Mantiene la misma API que un <select> con <option>, y un select oculto para formularios.
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, value, defaultValue, id, disabled, 'aria-label': ariaLabel, ...rest },
  ref,
) {
  const opciones = leerOpciones(children)
  const nativa = useRef<HTMLSelectElement | null>(null)
  const [interno, setInterno] = useState(String(defaultValue ?? opciones[0]?.value ?? ''))
  const actual = value !== undefined ? String(value) : interno

  function elegir(nuevo: string) {
    if (value === undefined) setInterno(nuevo)
    const el = nativa.current
    if (el) {
      el.value = nuevo
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  return (
    <div className="relative">
      <select
        {...rest}
        ref={(el) => {
          nativa.current = el
          if (typeof ref === 'function') ref(el)
          else if (ref) ref.current = el
        }}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      >
        {children}
      </select>
      <SelectPrimitive.Root
        value={actual}
        onValueChange={(v) => elegir(String(v))}
        disabled={disabled}
        items={opciones.map((o) => ({ value: o.value, label: o.label }))}
      >
        <SelectPrimitive.Trigger id={id} aria-label={ariaLabel} className={cn(campo, 'flex h-11 items-center justify-between gap-2 pr-3.5 text-left', className)}>
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon>
            <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-[70]">
            <SelectPrimitive.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 font-sans text-popover-foreground shadow-lg outline-none">
              <SelectPrimitive.List>
                {opciones.map((o) => (
                  <SelectPrimitive.Item
                    key={o.value}
                    value={o.value}
                    disabled={o.disabled}
                    className="flex h-10 cursor-default select-none items-center justify-between gap-3 rounded-lg px-3 text-[0.9375rem] outline-none data-[disabled]:opacity-45 data-[highlighted]:bg-muted data-[selected]:font-semibold"
                  >
                    <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                    <SelectPrimitive.ItemIndicator>
                      <Check className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
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

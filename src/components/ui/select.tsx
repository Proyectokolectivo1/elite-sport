import { Children, forwardRef, isValidElement, useRef, useState, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { campo } from '@/components/ui/input'

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


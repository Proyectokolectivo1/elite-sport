import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold uppercase tracking-[0.08em] select-none transition-[background-color,color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Acción principal: acento de la marca. */
        default: 'bg-signal text-signal-foreground hover:brightness-95',
        /** Tinta sólida, para acciones sobrias. */
        solid: 'bg-foreground text-background hover:opacity-90',
        /** Superficie de marca (color primario de la tienda). */
        brand: 'bg-brand text-brand-foreground hover:opacity-90',
        outline: 'border border-foreground/30 bg-transparent text-foreground hover:border-foreground hover:bg-foreground/5',
        ghost: 'bg-transparent text-foreground hover:bg-foreground/8',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        link: 'h-auto p-0 normal-case tracking-normal underline underline-offset-4 hover:opacity-70',
      },
      size: {
        sm: 'h-9 rounded-md px-3.5 text-[0.75rem]',
        default: 'h-11 rounded-md px-5 text-[0.8125rem]',
        lg: 'h-14 rounded-md px-8 text-sm',
        icon: 'size-11 rounded-md',
        'icon-sm': 'size-9 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />
})

export { Button, buttonVariants }

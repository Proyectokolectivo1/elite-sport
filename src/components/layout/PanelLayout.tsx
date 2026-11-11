import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Ellipsis, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Logo } from '@/components/layout/Logo'
import { ModeToggle } from '@/components/layout/ModeToggle'
import { cn } from '@/lib/utils'

export interface PanelNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Número de pendientes (ej. pedidos nuevos). */
  badge?: number
}

interface Props {
  nombre: string
  logoUrl?: string | null
  /** Etiqueta bajo el logo, ej. "Administración" o "Panel mayorista". */
  seccion: string
  nav: PanelNavItem[]
  /** Acciones a la derecha de la barra superior (usuario, salir). */
  acciones?: ReactNode
  /** Aviso destacado sobre el contenido (ej. plazo por vencer). */
  aviso?: ReactNode
  children?: ReactNode
}

/** Destinos fijos en la barra inferior del celular; el resto va en "Más". */
const MAX_BOTTOM = 4

/**
 * Panel: sidebar colapsable en escritorio y barra inferior en móvil.
 * En móvil muestra los primeros 5 destinos; el resto queda en el menú lateral de tablet+.
 */
export function PanelLayout({ nombre, logoUrl, seccion, nav, acciones, aviso, children }: Props) {
  const [colapsado, setColapsado] = useState(false)
  const [masAbierto, setMasAbierto] = useState(false)
  // Hasta 5 destinos caben en la barra; si hay más, 4 fijos y "Más".
  const principales = nav.length > 5 ? nav.slice(0, MAX_BOTTOM) : nav
  const resto = nav.length > 5 ? nav.slice(MAX_BOTTOM) : []

  return (
    <div className="min-h-dvh bg-background md:grid md:grid-cols-[auto_1fr]">
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out)] md:flex',
          colapsado ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <div className={cn('flex h-[4.5rem] items-center border-b border-sidebar-border px-5', colapsado && 'justify-center px-0')}>
          {colapsado ? <span aria-hidden className="-skew-x-[18deg] h-6 w-2 bg-signal" /> : <Logo nombre={nombre} logoUrl={logoUrl} />}
        </div>
        <nav aria-label={seccion} className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={colapsado ? label : undefined}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-md px-3 text-[0.8125rem] font-semibold uppercase tracking-[0.1em] transition-colors duration-[var(--dur-fast)]',
                  colapsado && 'justify-center px-0',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon className="size-[1.125rem] shrink-0" />
              {colapsado ? <span className="sr-only">{label}</span> : label}
              {!!badge && <span className="ml-auto rounded-full bg-signal px-2 py-0.5 text-[0.6875rem] font-bold text-signal-foreground tabular-nums">{badge}</span>}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setColapsado((c) => !c)}
          aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!colapsado}
          className="m-3 flex h-10 items-center justify-center gap-2 rounded-md text-xs font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {colapsado ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Colapsar</>}
        </button>
      </aside>

      <div className="flex min-w-0 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-[var(--gutter)] backdrop-blur md:h-[4.5rem]">
          <div className="md:hidden">
            <Logo nombre={nombre} logoUrl={logoUrl} className="text-xl" />
          </div>
          <span className="hidden md:block" />
          <div className="flex items-center gap-1">
            {acciones}
            <ModeToggle />
          </div>
        </header>
        <main id="contenido" className="px-[var(--gutter)] py-6 md:py-8">
          {aviso}
          {children ?? <Outlet />}
        </main>
      </div>

      <nav
        aria-label={`${seccion}, móvil`}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
        style={{ gridTemplateColumns: `repeat(${principales.length + (resto.length > 0 ? 1 : 0)}, minmax(0, 1fr))` }}
      >
        {principales.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold uppercase tracking-[0.08em]',
                isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/65',
              )
            }
          >
            <span className="relative">
              <Icon className="size-5" />
              {!!badge && <span className="absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-signal px-1 text-[0.625rem] font-bold leading-4 text-signal-foreground">{badge}</span>}
            </span>
            {label}
          </NavLink>
        ))}
        {resto.length > 0 && (
          <button
            type="button"
            onClick={() => setMasAbierto(true)}
            className="flex h-16 flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/65"
          >
            <Ellipsis className="size-5" />
            Más
          </button>
        )}
      </nav>

      {resto.length > 0 && (
        <Sheet open={masAbierto} onOpenChange={setMasAbierto}>
          <SheetContent side="bottom" title="Más opciones">
            <ul className="divide-y divide-border">
              {resto.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink to={to} onClick={() => setMasAbierto(false)} className="flex h-14 items-center gap-3 text-[1.0625rem] font-semibold">
                    <Icon className="size-5 text-muted-foreground" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

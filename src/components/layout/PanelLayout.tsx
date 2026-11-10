import { useState, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { ModeToggle } from '@/components/layout/ModeToggle'
import { cn } from '@/lib/utils'

export interface PanelNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface Props {
  nombre: string
  logoUrl?: string | null
  /** Etiqueta bajo el logo, ej. "Administración" o "Panel mayorista". */
  seccion: string
  nav: PanelNavItem[]
  /** Acciones a la derecha de la barra superior (usuario, salir). */
  acciones?: ReactNode
  children?: ReactNode
}

const MAX_BOTTOM = 5

/**
 * Panel: sidebar colapsable en escritorio y barra inferior en móvil.
 * En móvil muestra los primeros 5 destinos; el resto queda en el menú lateral de tablet+.
 */
export function PanelLayout({ nombre, logoUrl, seccion, nav, acciones, children }: Props) {
  const [colapsado, setColapsado] = useState(false)

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
          {nav.map(({ to, label, icon: Icon, end }) => (
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
          {children ?? <Outlet />}
        </main>
      </div>

      <nav
        aria-label={`${seccion}, móvil`}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, MAX_BOTTOM)}, minmax(0, 1fr))` }}
      >
        {nav.slice(0, MAX_BOTTOM).map(({ to, label, icon: Icon, end }) => (
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
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

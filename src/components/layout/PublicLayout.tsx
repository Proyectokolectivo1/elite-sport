import { lazy, Suspense, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, Search, ShoppingBag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/layout/Logo'
import { ModeToggle } from '@/components/layout/ModeToggle'
import { cn } from '@/lib/utils'

export interface NavItem {
  to: string
  label: string
  end?: boolean
  /** Se muestra como botón de acento (llamado a la acción). */
  destacado?: boolean
}

import type { MenuSeccion } from './MenuLateral'

// El menú (y la librería de diálogos) se descarga la primera vez que se abre, no con la portada.
const MenuLateral = lazy(() => import('./MenuLateral').then((m) => ({ default: m.MenuLateral })))

interface Props {
  /** Nombre y logo de la tienda activa (principal o de un mayorista). */
  nombre: string
  logoUrl?: string | null
  /** Ruta base: "/" para la principal, "/t/slug" para un mayorista. */
  basePath?: string
  nav?: NavItem[]
  /** Secciones del menú lateral (hamburguesa). Si no se pasan, no hay menú. */
  menu?: MenuSeccion[]
  cartCount?: number
  onCartClick?: () => void
  onSearch?: (query: string) => void
  /** Texto del pie (dirección, redes). */
  footer?: ReactNode
  /** Si no se pasa, el layout renderiza <Outlet /> (rutas anidadas). */
  children?: ReactNode
}

export function PublicLayout({
  nombre,
  logoUrl,
  basePath = '/',
  nav = [],
  menu = [],
  cartCount = 0,
  onCartClick,
  onSearch,
  footer,
  children,
}: Props) {
  const [buscando, setBuscando] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [menuCargado, setMenuCargado] = useState(false)
  if (menuAbierto && !menuCargado) setMenuCargado(true)
  const [q, setQ] = useState('')

  function enviar(e: FormEvent) {
    e.preventDefault()
    onSearch?.(q.trim())
    setBuscando(false)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-signal focus:px-4 focus:py-2 focus:text-signal-foreground"
      >
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-40 bg-brand text-brand-foreground">
        <div className="container-page flex h-16 items-center gap-4 md:h-[4.5rem]">
          <Link to={basePath} className="shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current">
            <Logo nombre={nombre} logoUrl={logoUrl} />
          </Link>

          <nav aria-label="Principal" className="ml-6 hidden gap-6 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  item.destacado
                    ? 'ml-2 inline-flex h-9 items-center rounded-md border border-signal px-3.5 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-signal transition-colors hover:bg-signal hover:text-signal-foreground'
                    : cn(
                    'relative py-1 text-[0.8125rem] font-semibold uppercase tracking-[0.12em] opacity-75 transition-opacity hover:opacity-100',
                    "after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-signal after:transition-transform after:duration-[var(--dur-base)] after:content-['']",
                    isActive && 'opacity-100 after:scale-x-100',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {onSearch && (
              <Button variant="ghost" size="icon-sm" className="text-current hover:bg-white/10" aria-label="Buscar" onClick={() => setBuscando(true)}>
                <Search />
              </Button>
            )}
            <ModeToggle className="text-current hover:bg-white/10" />
            <Button variant="ghost" size="icon-sm" className="relative text-current hover:bg-white/10" aria-label={`Carrito, ${cartCount} productos`} onClick={onCartClick}>
              <ShoppingBag />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid min-w-[1.125rem] place-items-center rounded-full bg-signal px-1 text-[0.625rem] font-bold leading-[1.125rem] text-signal-foreground tabular-nums">
                  {cartCount}
                </span>
              )}
            </Button>
            {menu.length > 0 && (
              <Button variant="ghost" size="icon-sm" className="text-current hover:bg-white/10" aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}>
                <Menu />
              </Button>
            )}
          </div>
        </div>

        {buscando && (
          <form onSubmit={enviar} role="search" className="border-t border-white/10">
            <div className="container-page flex items-center gap-2 py-3">
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Busca por modelo, marca o estilo"
                aria-label="Buscar productos"
                className="border-white/20 bg-white/10 text-current placeholder:text-current/60"
              />
              <Button type="submit" size="default">
                Buscar
              </Button>
              <Button type="button" variant="ghost" size="icon" className="text-current hover:bg-white/10" aria-label="Cerrar búsqueda" onClick={() => setBuscando(false)}>
                <X />
              </Button>
            </div>
          </form>
        )}

        {nav.length > 0 && (
          <nav aria-label="Principal móvil" className="container-page flex gap-5 overflow-x-auto border-t border-white/10 py-2.5 md:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  item.destacado
                    ? 'ml-auto shrink-0 rounded-md bg-signal px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-signal-foreground'
                    : cn('shrink-0 text-[0.75rem] font-semibold uppercase tracking-[0.12em] opacity-70', isActive && 'opacity-100 underline decoration-signal decoration-2 underline-offset-[6px]')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {menu.length > 0 && menuCargado && (
        <Suspense fallback={null}>
          <MenuLateral abierto={menuAbierto} onCambio={setMenuAbierto} secciones={menu} />
        </Suspense>
      )}

      <main id="contenido" className="flex-1">
        {children ?? <Outlet />}
      </main>

      <footer className="bg-brand text-brand-foreground">
        <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between">
          <div>
            <Logo nombre={nombre} logoUrl={logoUrl} />
            <div className="mt-3 max-w-sm text-sm opacity-70">{footer}</div>
          </div>
          <p className="text-xs opacity-60">© {new Date().getFullYear()} {nombre}</p>
        </div>
      </footer>
    </div>
  )
}

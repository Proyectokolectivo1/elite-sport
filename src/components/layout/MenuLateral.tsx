import { Link } from 'react-router-dom'
import { Sheet, SheetContent } from '@/components/ui/sheet'

export interface MenuSeccion {
  titulo: string
  items: { to: string; label: string; detalle?: string }[]
}

interface Props {
  abierto: boolean
  onCambio: (abierto: boolean) => void
  secciones: MenuSeccion[]
}

/** Cajón del menú de la tienda: Comprar, Mayoristas y Administración. */
export function MenuLateral({ abierto, onCambio, secciones }: Props) {
  return (
    <Sheet open={abierto} onOpenChange={onCambio}>
      <SheetContent side="right" title="Menú">
        <nav aria-label="Menú" className="space-y-8">
          {secciones.map((sec) => (
            <section key={sec.titulo}>
              <h2 className="mb-3 text-lg text-muted-foreground">{sec.titulo}</h2>
              <ul className="divide-y divide-border border-y border-border">
                {sec.items.map((it) => (
                  <li key={it.to + it.label}>
                    <Link to={it.to} onClick={() => onCambio(false)} className="block py-3.5 hover:opacity-70">
                      <span className="block text-[1.0625rem] font-semibold">{it.label}</span>
                      {it.detalle && <span className="mt-0.5 block text-sm text-muted-foreground">{it.detalle}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

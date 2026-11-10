import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { ProductoPublico } from '../api/tienda'
import { contarFiltros, FILTROS_VACIOS, type Filtros } from '../filtros'

interface Props {
  productos: ProductoPublico[]
  filtros: Filtros
  onChange: (f: Filtros) => void
}

const GRUPOS = [
  { id: '', label: 'Todos' },
  { id: 'dama', label: 'Dama' },
  { id: 'caballero', label: 'Caballero' },
  { id: 'nino', label: 'Niño' },
] as const

function unicos(items: ({ id: string; nombre: string } | null)[]) {
  return [...new Map(items.flatMap((i) => (i ? [[i.id, i] as const] : []))).values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export function FiltrosPanel({ productos, filtros, onChange }: Props) {
  const set = (parcial: Partial<Filtros>) => onChange({ ...filtros, ...parcial })

  const opciones = useMemo(() => {
    const delGrupo = filtros.grupo ? productos.filter((p) => p.grupo === filtros.grupo) : productos
    const tallas = [...new Map(delGrupo.flatMap((p) => p.variantes).filter((v) => v.stock > 0).map((v) => [v.talla, v.orden])).entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([t]) => t)
    return {
      marcas: unicos(productos.map((p) => p.marca)),
      estilos: unicos(productos.map((p) => p.estilo)),
      categorias: unicos(productos.map((p) => p.categoria)),
      tallas,
    }
  }, [productos, filtros.grupo])

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="eyebrow mb-2">Para quién</legend>
        <div className="flex flex-wrap gap-2">
          {GRUPOS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={filtros.grupo === g.id}
              onClick={() => set({ grupo: g.id, talla: '' })}
              className={cn('h-10 rounded-md border px-4 text-[0.8125rem] font-semibold transition-colors', filtros.grupo === g.id ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground')}
            >
              {g.label}
            </button>
          ))}
        </div>
      </fieldset>

      {opciones.tallas.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-2">Talla disponible</legend>
          <div className="grid grid-cols-5 gap-2">
            {opciones.tallas.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={filtros.talla === t}
                onClick={() => set({ talla: filtros.talla === t ? '' : t })}
                className={cn('h-10 rounded-md border text-sm font-semibold tabular-nums transition-colors', filtros.talla === t ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground')}
              >
                {t}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {([
        ['marca', 'Marca', opciones.marcas],
        ['estilo', 'Estilo', opciones.estilos],
        ['categoria', 'Categoría', opciones.categorias],
      ] as const).map(([campo, etiqueta, lista]) =>
        lista.length > 0 ? (
          <div key={campo}>
            <Label htmlFor={`f-${campo}`}>{etiqueta}</Label>
            <Select id={`f-${campo}`} value={filtros[campo]} onChange={(e) => set({ [campo]: e.target.value })}>
              <option value="">Todas</option>
              {lista.map((o) => (
                <option key={o.id} value={o.id}>{o.nombre}</option>
              ))}
            </Select>
          </div>
        ) : null,
      )}

      <fieldset>
        <legend className="eyebrow mb-2">Precio</legend>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="Precio mínimo" type="number" min="0" inputMode="decimal" placeholder="Mín." value={filtros.min ?? ''} onChange={(e) => set({ min: e.target.value === '' ? null : Number(e.target.value) })} />
          <Input aria-label="Precio máximo" type="number" min="0" inputMode="decimal" placeholder="Máx." value={filtros.max ?? ''} onChange={(e) => set({ max: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </fieldset>

      {contarFiltros(filtros) > 0 && (
        <Button type="button" variant="outline" className="w-full" onClick={() => onChange({ ...FILTROS_VACIOS, q: filtros.q, orden: filtros.orden })}>
          Limpiar filtros
        </Button>
      )}
    </div>
  )
}

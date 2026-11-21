import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useLocales } from '@/features/bodega/hooks/useBodega'
import { NOMBRE_PIEZA } from '../logica'
import type { FilaExhibicion, Pieza } from '../schemas'

interface Props {
  filas: FilaExhibicion[]
  onChange: (f: FilaExhibicion[]) => void
  /** Tallas del modelo, para elegir la de cada pieza. */
  tallas: string[]
  error?: string | null
}

let contador = 0
const nueva = (pieza: Pieza): FilaExhibicion => ({ clave: `ex-${++contador}`, color: '', talla: '', pieza, localId: '' })

/**
 * Pares de exhibición al crear el producto: cada pieza (par completo, pie derecho o pie izquierdo) lleva su color, su talla y el local donde se exhibe.
 * Al guardar se crea la talla y los pares de exhibición cuentan en el stock.
 */
export function ExhibicionProducto({ filas, onChange, tallas, error }: Props) {
  const { data: locales = [] } = useLocales()
  const activos = locales.filter((l) => l.activo)
  const cambiar = (clave: string, parcial: Partial<FilaExhibicion>) => onChange(filas.map((f) => (f.clave === clave ? { ...f, ...parcial } : f)))

  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-lg font-semibold">Pares de exhibición (opcional)</legend>
      <p className="text-sm text-muted-foreground">
        Marca en qué local está cada pieza: el par completo en uno, el pie derecho en otro y el izquierdo en otro. Cada pieza puede ser de otra talla y color.
        Un pie derecho y un pie izquierdo de la misma talla y color forman un par. Estos pares se suman al stock.
      </p>

      {filas.length > 0 && (
        <ul className="space-y-3">
          {filas.map((f, i) => (
            <li key={f.clave} className="grid gap-3 rounded-lg border border-input p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end">
              <div>
                <Label htmlFor={`${f.clave}-pieza`}>Pieza</Label>
                <Select id={`${f.clave}-pieza`} value={f.pieza} onChange={(e) => cambiar(f.clave, { pieza: e.target.value as Pieza })}>
                  {(Object.keys(NOMBRE_PIEZA) as Pieza[]).map((k) => (
                    <option key={k} value={k}>{NOMBRE_PIEZA[k]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${f.clave}-color`}>Color</Label>
                <Input id={`${f.clave}-color`} value={f.color} maxLength={40} placeholder="Ej. Negro" onChange={(e) => cambiar(f.clave, { color: e.target.value })} />
              </div>
              <div>
                <Label htmlFor={`${f.clave}-talla`}>Talla</Label>
                <Select id={`${f.clave}-talla`} value={f.talla} onChange={(e) => cambiar(f.clave, { talla: e.target.value })}>
                  <option value="">Elige la talla</option>
                  {tallas.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor={`${f.clave}-local`}>Local</Label>
                <Select id={`${f.clave}-local`} value={f.localId} onChange={(e) => cambiar(f.clave, { localId: e.target.value })}>
                  <option value="">Elige el local</option>
                  {activos.map((l) => (
                    <option key={l.id} value={l.id}>Local {l.nombre}</option>
                  ))}
                </Select>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar la pieza ${i + 1}`} onClick={() => onChange(filas.filter((x) => x.clave !== f.clave))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => onChange([...filas, nueva('par'), nueva('derecho'), nueva('izquierdo')])}>
          <Plus /> Agregar los 2 pares (completo + derecho + izquierdo)
        </Button>
        <Button type="button" variant="ghost" onClick={() => onChange([...filas, nueva('par')])}>
          <Plus /> Agregar una pieza
        </Button>
      </div>
    </fieldset>
  )
}

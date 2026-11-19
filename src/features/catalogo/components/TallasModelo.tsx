import { FieldError, Input, Label } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { filasModelo, generarRango, paresDeCaja } from '../tallasModelo'

export interface TallasModeloEstado {
  desde: string
  hasta: string
  /** Pares por caja por etiqueta de talla, tal como se escriben. */
  pares: Record<string, string>
}

interface Props {
  valor: TallasModeloEstado
  onChange: (v: TallasModeloEstado) => void
  errores: Partial<Record<'desde' | 'hasta' | 'pares', string>>
}

/** Rango de tallas del modelo y surtido de la caja: cuántos pares de cada talla trae una caja. */
export function TallasModelo({ valor, onChange, errores }: Props) {
  const desde = Number(valor.desde)
  const hasta = Number(valor.hasta)
  const tallas = generarRango(desde, hasta)
  const porCaja = paresDeCaja(filasModelo(desde, hasta, valor.pares))

  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-lg font-semibold">Tallas y surtido de la caja</legend>
      <p className="text-sm text-muted-foreground">
        Define de qué talla a qué talla viene este modelo y cuántos pares de cada una trae una caja. Al ingresar mercancía por caja se usa este surtido.
      </p>
      <div className="grid max-w-sm grid-cols-2 gap-4">
        <div>
          <Label htmlFor="talla-desde">Desde la talla</Label>
          <Input id="talla-desde" type="number" min="10" max="60" step="1" inputMode="numeric" aria-invalid={!!errores.desde}
            value={valor.desde} onChange={(e) => onChange({ ...valor, desde: e.target.value })} />
          <FieldError>{errores.desde}</FieldError>
        </div>
        <div>
          <Label htmlFor="talla-hasta">Hasta la talla</Label>
          <Input id="talla-hasta" type="number" min="10" max="60" step="1" inputMode="numeric" aria-invalid={!!errores.hasta}
            value={valor.hasta} onChange={(e) => onChange({ ...valor, hasta: e.target.value })} />
          <FieldError>{errores.hasta}</FieldError>
        </div>
      </div>

      {tallas.length > 0 && tallas.length <= 40 && (
        <>
          <p className="text-sm font-semibold">Pares por caja <span className="font-normal text-muted-foreground">(deja vacío o 0 si esa talla no viene en la caja)</span></p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {tallas.map((t) => (
              <label key={t} className={cn('rounded-lg border border-input p-2 text-center', Number(valor.pares[t]) > 0 && 'border-foreground')}>
                <span className="block text-base font-bold tabular-nums">{t}</span>
                <Input
                  aria-label={`Pares por caja, talla ${t}`}
                  type="number" min="0" max="100" step="1" inputMode="numeric" placeholder="0"
                  className="mt-1 h-9 text-center"
                  value={valor.pares[t] ?? ''}
                  onChange={(e) => onChange({ ...valor, pares: { ...valor.pares, [t]: e.target.value } })}
                />
              </label>
            ))}
          </div>
          <FieldError>{errores.pares}</FieldError>
          <p className="text-sm text-muted-foreground">
            {tallas.length} tallas ({tallas[0]} a {tallas[tallas.length - 1]}) · cada caja trae <strong className="tabular-nums text-foreground">{porCaja}</strong> {porCaja === 1 ? 'par' : 'pares'}.
          </p>
        </>
      )}
    </fieldset>
  )
}

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { useLocales } from '@/features/bodega/hooks/useBodega'
import { useExistencias } from '@/features/inventario/hooks/useInventario'
import { mensajeError } from '@/lib/errors'
import { NOMBRE_PIEZA, paresEnExhibicion, soloExhibicion } from '../logica'
import { altaExhibicionSchema, type AltaExhibicionValues, type Exhibicion } from '../schemas'
import { useExhibiciones, useQuitarExhibicion, useRegistrarExhibicion } from '../hooks/useExhibicion'

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Dónde está cada par de exhibición: qué local tiene el par completo, el pie derecho y el pie izquierdo. */
export function ExhibicionTab() {
  const { data: piezas = [], isLoading, error } = useExhibiciones()
  const { data: existencias = [] } = useExistencias()
  const { data: locales = [] } = useLocales()
  const registrar = useRegistrarExhibicion()
  const quitar = useQuitarExhibicion()
  const [productoId, setProductoId] = useState('')
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AltaExhibicionValues>({
    resolver: zodResolver(altaExhibicionSchema),
    defaultValues: { varianteId: '', localId: '', pieza: 'par' },
  })

  const productos = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of existencias) m.set(e.productoId, e.producto)
    return [...m].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [existencias])
  const variantes = existencias.filter((e) => e.productoId === productoId)
  const stockDe = useMemo(() => new Map(existencias.map((e) => [e.id, e.stock])), [existencias])

  // Una tarjeta por producto · color · talla, con sus piezas.
  const grupos = useMemo(() => {
    const m = new Map<string, Exhibicion[]>()
    for (const p of piezas) m.set(p.variante_id, [...(m.get(p.variante_id) ?? []), p])
    return [...m.values()]
  }, [piezas])

  function onSubmit(v: AltaExhibicionValues) {
    registrar.mutate(v, {
      onSuccess: () => {
        toast.success('Pieza de exhibición registrada')
        reset({ varianteId: '', localId: '', pieza: 'par' })
        setProductoId('')
      },
      onError: (e) => toast.error(mensajeError(e)),
    })
  }

  function onQuitar(p: Exhibicion) {
    if (!window.confirm(`¿Quitar ${NOMBRE_PIEZA[p.pieza].toLowerCase()} del Local ${p.local}? Ya no aparecerá como exhibición.`)) return
    quitar.mutate(p.id, { onSuccess: () => toast.success('Pieza quitada'), onError: (e) => toast.error(mensajeError(e)) })
  }

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Los pares de exhibición cuentan dentro del stock de bodega, pero están físicamente en un local. Aquí se marca en qué local está cada pieza para no buscarla en bodega.
        Un derecho de un local y un izquierdo de otro se venden juntos como un par.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <Label htmlFor="ex-producto">Producto</Label>
          <Select id="ex-producto" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            <option value="">Elige el producto</option>
            {productos.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="ex-variante">Color y talla</Label>
          <Select id="ex-variante" disabled={!productoId} aria-invalid={!!errors.varianteId} {...register('varianteId')}>
            <option value="">Elige color y talla</option>
            {variantes.map((v) => (
              <option key={v.id} value={v.id}>{v.color} · talla {v.talla}</option>
            ))}
          </Select>
          <FieldError>{errors.varianteId?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="ex-local">Local</Label>
          <Select id="ex-local" aria-invalid={!!errors.localId} {...register('localId')}>
            <option value="">Elige el local</option>
            {locales.filter((l) => l.activo).map((l) => (
              <option key={l.id} value={l.id}>Local {l.nombre}</option>
            ))}
          </Select>
          <FieldError>{errors.localId?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="ex-pieza">Pieza</Label>
          <Select id="ex-pieza" {...register('pieza')}>
            {(Object.keys(NOMBRE_PIEZA) as (keyof typeof NOMBRE_PIEZA)[]).map((k) => (
              <option key={k} value={k}>{NOMBRE_PIEZA[k]}</option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={registrar.isPending}>Agregar</Button>
      </form>

      {isLoading && <Skeleton className="h-40 w-full" />}
      {error && <p role="alert" className="text-destructive">{mensajeError(error)}</p>}
      {!isLoading && !error && grupos.length === 0 && (
        <EmptyState title="Sin pares de exhibición" description="Cuando marques una pieza en un local, aparecerá aquí con su ubicación." />
      )}

      <ul className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => {
          const base = g[0]
          const stock = stockDe.get(base.variante_id) ?? 0
          const solo = soloExhibicion(stock, g)
          return (
            <li key={base.variante_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-2xl">{base.producto}</h3>
                  <p className="text-sm text-muted-foreground">
                    {base.color} · talla {base.talla} · {plural(paresEnExhibicion(g), 'par', 'pares')} de exhibición · {plural(stock, 'par', 'pares')} en total
                  </p>
                </div>
                {solo && <Badge variant="warning">Solo quedan pares de exhibición</Badge>}
              </div>
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {g.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <strong>{NOMBRE_PIEZA[p.pieza]}</strong>
                      <span className="text-muted-foreground"> · Local {p.local}</span>
                      {p.estado === 'reservada' && <Badge variant="signal" className="ml-2">Pedido #{p.pedido_numero} en curso</Badge>}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar ${NOMBRE_PIEZA[p.pieza].toLowerCase()} del Local ${p.local}`}
                      disabled={p.estado === 'reservada' || quitar.isPending}
                      onClick={() => onQuitar(p)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

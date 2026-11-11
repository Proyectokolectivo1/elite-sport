import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { useTallas } from '@/features/catalogo/hooks/useCatalogo'
import type { GrupoTalla } from '@/features/catalogo/api/catalogo'
import { GRUPOS } from '@/features/catalogo/schemas'
import { mensajeError } from '@/lib/errors'
import { useCrearCurva, useCurvas, useEliminarCurva } from '../hooks/useInventario'

export function CurvasTab() {
  const { data: curvas = [], isLoading } = useCurvas()
  const { data: tallas = [] } = useTallas()
  const crear = useCrearCurva()
  const eliminar = useEliminarCurva()
  const [nombre, setNombre] = useState('')
  const [grupo, setGrupo] = useState<GrupoTalla>('dama')
  const [pares, setPares] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const tallasGrupo = tallas.filter((t) => t.grupo === grupo)
  const etiqueta = (id: string) => tallas.find((t) => t.id === id)?.etiqueta ?? '?'

  async function guardar() {
    const detalle = tallasGrupo
      .map((t) => ({ talla_id: t.id, pares: Number(pares[t.id] || 0) }))
      .filter((d) => d.pares > 0)
    if (nombre.trim().length < 2) return setError('Ponle un nombre al surtido.')
    if (detalle.length === 0 || detalle.some((d) => !Number.isInteger(d.pares))) return setError('Indica los pares por talla (números enteros).')
    setError(null)
    try {
      await crear.mutateAsync([nombre, grupo, detalle])
      toast.success('Surtido guardado')
      setNombre('')
      setPares({})
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
      <section>
        <h2 className="mb-4 text-3xl">Surtidos guardados</h2>
        {isLoading && <Skeleton className="h-40 w-full" />}
        {!isLoading && curvas.length === 0 && <EmptyState title="Aún no hay surtidos" description="Guarda el surtido típico de tus cajas para ingresarlas más rápido." />}
        <ul className="space-y-3">
          {curvas.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-semibold">{c.nombre}</p>
                <p className="eyebrow mt-0.5 capitalize">{c.grupo === 'nino' ? 'niño' : c.grupo} · {c.detalle.reduce((s, d) => s + d.pares, 0)} pares</p>
                <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                  {c.detalle
                    .slice()
                    .sort((a, b) => Number(etiqueta(a.talla_id)) - Number(etiqueta(b.talla_id)))
                    .map((d) => `${etiqueta(d.talla_id)} × ${d.pares}`)
                    .join('   ')}
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${c.nombre}`} onClick={() => eliminar.mutate(c.id, { onError: (e) => toast.error(mensajeError(e)) })}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4 self-start rounded-xl border border-border bg-card p-5">
        <h2 className="text-3xl">Nuevo surtido</h2>
        <div>
          <Label htmlFor="cv-nombre">Nombre</Label>
          <Input id="cv-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Caja dama 12 pares" />
        </div>
        <div>
          <Label htmlFor="cv-grupo">Grupo</Label>
          <Select id="cv-grupo" value={grupo} onChange={(e) => { setGrupo(e.target.value as GrupoTalla); setPares({}) }}>
            {GRUPOS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </div>
        <div>
          <p className="eyebrow mb-2">Pares por talla</p>
          <div className="grid grid-cols-3 gap-2">
            {tallasGrupo.map((t) => (
              <label key={t.id} className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                {t.etiqueta}
                <Input type="number" min="0" step="1" inputMode="numeric" className="h-10 px-2 text-center" value={pares[t.id] ?? ''} placeholder="0" onChange={(e) => setPares((p) => ({ ...p, [t.id]: e.target.value }))} />
              </label>
            ))}
          </div>
        </div>
        <FieldError>{error ?? undefined}</FieldError>
        <Button className="w-full" disabled={crear.isPending} onClick={() => void guardar()}>Guardar surtido</Button>
      </section>
    </div>
  )
}

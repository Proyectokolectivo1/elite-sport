import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { obtenerCatalogoPublico } from '@/features/tienda/api/tienda'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { useCostos, useGuardarPrecios, useMiTienda, usePreciosMiTienda } from '../hooks/useMayorista'
import { costoMayorista, margen, precioConMargen } from '../precio'
import type { CambioPrecio } from '../api/mayorista'

export function MisPreciosPage() {
  const { data: tienda } = useMiTienda()
  const { data: catalogo = [], isLoading } = useQuery({ queryKey: ['catalogo-publico'], queryFn: obtenerCatalogoPublico })
  const { data: costos = [] } = useCostos()
  const { data: guardados = {} } = usePreciosMiTienda(tienda?.id)
  const guardar = useGuardarPrecios(tienda?.id ?? '')
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)

  /** Ediciones sin guardar: producto -> texto del input ('' = usar PVP). */
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [pct, setPct] = useState('')

  const filas = useMemo(() => {
    const mapa = new Map(costos.map((c) => [c.productoId, costoMayorista(c.base, c.especial)]))
    return catalogo.map((p) => ({ p, costo: mapa.get(p.id) ?? null }))
  }, [catalogo, costos])

  const valorDe = (id: string) => edits[id] ?? (guardados[id] !== undefined ? String(guardados[id]) : '')
  const cambios: CambioPrecio[] = Object.entries(edits).flatMap(([productoId, txt]) => {
    const actual = guardados[productoId]
    const nuevo = txt.trim() === '' ? null : Number(txt)
    if (nuevo !== null && (!Number.isFinite(nuevo) || nuevo < 0)) return []
    return (nuevo ?? undefined) === actual ? [] : [{ productoId, precio: nuevo }]
  })
  const invalidos = Object.values(edits).some((t) => t.trim() !== '' && (!Number.isFinite(Number(t)) || Number(t) < 0))

  function aplicarMargen() {
    const n = Number(pct)
    if (!Number.isFinite(n) || n < 0) return toast.error('Ingresa un porcentaje válido.')
    const nuevos: Record<string, string> = {}
    for (const { p, costo } of filas) if (costo !== null) nuevos[p.id] = String(precioConMargen(costo, n))
    setEdits((e) => ({ ...e, ...nuevos }))
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (!tienda) return null
  return (
    <>
      <PageHeader eyebrow="Tu catálogo" title="Mis precios" description="Fija el precio al que vendes cada producto en tu sección. Si lo dejas vacío, se muestra el precio al público." />

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-border bg-card p-4">
        <div>
          <label htmlFor="pct" className="eyebrow mb-1.5 block">Margen sobre mi costo (%)</label>
          <Input id="pct" type="number" min="0" step="1" inputMode="decimal" className="w-32" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Ej. 35" />
        </div>
        <Button variant="outline" onClick={aplicarMargen} disabled={pct === ''}>Aplicar a todos</Button>
        <p className="text-xs text-muted-foreground">Calcula tu precio como costo + margen. Revisa y guarda.</p>
      </div>

      {filas.length === 0 ? <EmptyState title="Sin productos" description="Aún no hay productos en el catálogo." /> : (
        <Table>
          <THead>
            <TR><TH>Producto</TH><TH className="text-right">PVP</TH><TH className="text-right">Mi costo</TH><TH>Mi precio</TH><TH className="text-right">Margen</TH></TR>
          </THead>
          <TBody>
            {filas.map(({ p, costo }) => {
              const txt = valorDe(p.id)
              const venta = txt.trim() === '' ? p.pvp : Number(txt)
              const m = costo !== null && Number.isFinite(venta) ? margen(venta, costo) : null
              return (
                <TR key={p.id}>
                  <TD className="font-semibold">{p.nombre}</TD>
                  <TD className="text-right tabular-nums text-muted-foreground">{fmt(p.pvp)}</TD>
                  <TD className="text-right tabular-nums">{costo === null ? '—' : fmt(costo)}</TD>
                  <TD>
                    <Input aria-label={`Mi precio de ${p.nombre}`} type="number" min="0" step="0.01" inputMode="decimal" placeholder={String(p.pvp)} className="ml-0 h-9 w-28" value={txt} onChange={(e) => setEdits((x) => ({ ...x, [p.id]: e.target.value }))} />
                  </TD>
                  <TD className={`text-right tabular-nums ${m && m.monto < 0 ? 'text-destructive' : ''}`}>{m ? `${fmt(m.monto)} · ${m.pct}%` : '—'}</TD>
                </TR>
              )
            })}
          </TBody>
        </Table>
      )}

      <div className="sticky bottom-20 z-20 mt-5 flex items-center justify-between gap-3 rounded-md border border-border bg-popover p-3 shadow-md md:bottom-4">
        <p className="text-sm text-muted-foreground">{cambios.length === 0 ? 'Sin cambios pendientes.' : `${cambios.length} ${cambios.length === 1 ? 'cambio' : 'cambios'} sin guardar.`}</p>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={Object.keys(edits).length === 0} onClick={() => setEdits({})}>Descartar</Button>
          <Button
            disabled={cambios.length === 0 || invalidos || guardar.isPending}
            onClick={() => guardar.mutate(cambios, { onSuccess: () => { setEdits({}); toast.success('Precios guardados') }, onError: (e) => toast.error(mensajeError(e)) })}
          >
            Guardar precios
          </Button>
        </div>
      </div>
    </>
  )
}

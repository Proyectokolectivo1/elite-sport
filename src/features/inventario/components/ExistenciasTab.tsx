import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import type { Existencia } from '../api/inventario'
import { useAjustarStock, useExistencias } from '../hooks/useInventario'

export function ExistenciasTab() {
  const { data = [], isLoading } = useExistencias()
  const ajustar = useAjustarStock()
  const [q, setQ] = useState('')
  const [soloBajas, setSoloBajas] = useState(false)
  const [objetivo, setObjetivo] = useState<Existencia | null>(null)
  const [delta, setDelta] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return data.filter((e) => (!t || `${e.producto} ${e.color}`.toLowerCase().includes(t)) && (!soloBajas || e.stock <= 3))
  }, [data, q, soloBajas])

  function abrir(e: Existencia) {
    setObjetivo(e)
    setDelta('')
    setNota('')
    setError(null)
  }

  async function confirmar() {
    const d = Number(delta)
    if (!objetivo) return
    if (!Number.isInteger(d) || d === 0) return setError('Indica un número entero distinto de 0 (negativo para restar).')
    if (objetivo.stock + d < 0) return setError('El stock no puede quedar negativo.')
    if (!nota.trim()) return setError('El ajuste requiere una nota.')
    try {
      await ajustar.mutateAsync({ varianteId: objetivo.id, delta: d, nota: nota.trim() })
      toast.success('Stock ajustado')
      setObjetivo(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o color" aria-label="Buscar existencias" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--foreground)]" checked={soloBajas} onChange={(e) => setSoloBajas(e.target.checked)} /> Solo stock bajo (3 o menos)
        </label>
      </div>
      {filas.length === 0 ? (
        <EmptyState title="Sin existencias" description="Registra un ingreso para que aparezcan aquí." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Producto</TH>
              <TH>Color</TH>
              <TH>Talla</TH>
              <TH className="text-right">Stock</TH>
              <TH><span className="sr-only">Acciones</span></TH>
            </TR>
          </THead>
          <TBody>
            {filas.map((e) => (
              <TR key={e.id}>
                <TD className="font-semibold">{e.producto}</TD>
                <TD>{e.color}</TD>
                <TD className="tabular-nums">{e.talla}</TD>
                <TD className="text-right tabular-nums">
                  {e.stock === 0 ? <Badge variant="destructive">Agotado</Badge> : e.stock <= 3 ? <Badge variant="warning">{e.stock}</Badge> : e.stock}
                </TD>
                <TD className="text-right">
                  <Button size="sm" variant="outline" onClick={() => abrir(e)}>Ajustar</Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Dialog open={!!objetivo} onOpenChange={(o) => !o && setObjetivo(null)}>
        <DialogContent title="Ajustar stock" description={objetivo ? `${objetivo.producto} · ${objetivo.color} · talla ${objetivo.talla}. Stock actual: ${objetivo.stock}.` : undefined}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="aj-delta">Cantidad a sumar o restar</Label>
              <Input id="aj-delta" type="number" step="1" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Ej. -2" />
            </div>
            <div>
              <Label htmlFor="aj-nota">Motivo</Label>
              <Input id="aj-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Par dañado, conteo físico" />
            </div>
            <FieldError>{error ?? undefined}</FieldError>
            <div className="flex justify-end gap-2">
              <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
              <Button disabled={ajustar.isPending} onClick={() => void confirmar()}>Aplicar ajuste</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, PackagePlus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { mensajeError } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Existencia } from '../api/inventario'
import { agruparPorProducto, resumir, UMBRAL_TALLA, type EstadoStock, type ProductoStock } from '../agrupar'
import { useAjustarStock, useExistencias, useMiniaturas } from '../hooks/useInventario'

type Filtro = 'todos' | EstadoStock

const ETIQUETA: Record<EstadoStock, { texto: string; variante: 'success' | 'warning' | 'destructive' }> = {
  disponible: { texto: 'Disponible', variante: 'success' },
  bajo: { texto: 'Stock bajo', variante: 'warning' },
  agotado: { texto: 'Agotado', variante: 'destructive' },
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** Casilla de una talla: grande, con el número de pares. Rojo si no hay, ámbar si quedan pocas. */
function Talla({ e, onClick }: { e: Existencia; onClick: () => void }) {
  const agotada = e.stock === 0
  const poca = !agotada && e.stock <= UMBRAL_TALLA
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Talla ${e.talla}: ${plural(e.stock, 'par', 'pares')}. Ajustar`}
      className={cn(
        'flex min-w-[4.25rem] flex-col items-center rounded-lg border px-3 py-2 text-center transition-colors hover:border-foreground',
        agotada ? 'border-border bg-muted/40 text-muted-foreground' : poca ? 'border-warning/60 bg-warning/10' : 'border-border bg-card',
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Talla {e.talla}</span>
      <span className={cn('font-display text-3xl font-bold leading-none tabular-nums', agotada && 'line-through decoration-1')}>{e.stock}</span>
    </button>
  )
}

export function ExistenciasTab() {
  const { data = [], isLoading } = useExistencias()
  const { data: fotos = {} } = useMiniaturas()
  const ajustar = useAjustarStock()
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [objetivo, setObjetivo] = useState<Existencia | null>(null)
  const [delta, setDelta] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productos = useMemo(() => agruparPorProducto(data), [data])
  const resumen = useMemo(() => resumir(productos), [productos])
  const filas = useMemo(() => {
    const t = q.trim().toLowerCase()
    return productos
      .filter((p) => (filtro === 'todos' || p.estado === filtro) && (!t || `${p.producto} ${p.colores.map((c) => c.color).join(' ')}`.toLowerCase().includes(t)))
      // Lo que urge primero: agotados y stock bajo antes que lo disponible.
      .sort((a, b) => (filtro === 'todos' ? orden(a) - orden(b) : 0) || a.producto.localeCompare(b.producto, 'es'))
  }, [productos, q, filtro])
  // El detalle se lee de los datos vivos: tras ajustar, los números se actualizan solos.
  const detalle = productos.find((p) => p.productoId === abierto) ?? null

  function ajustarTalla(e: Existencia) {
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
      setObjetivo(null)
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  function cerrar(abierta: boolean) {
    if (abierta) return
    setAbierto(null)
    setObjetivo(null)
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />

  const tarjetas: { id: Filtro; etiqueta: string; valor: number; tono?: string }[] = [
    { id: 'todos', etiqueta: 'Productos', valor: resumen.productos },
    { id: 'bajo', etiqueta: 'Stock bajo', valor: resumen.bajos, tono: 'text-warning' },
    { id: 'agotado', etiqueta: 'Agotados', valor: resumen.agotados, tono: 'text-destructive' },
  ]

  return (
    <div className="space-y-5">
      <section aria-label="Resumen del inventario" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="eyebrow">Pares en bodega</p>
          <p className="mt-1 font-display text-4xl font-bold leading-none tabular-nums">{resumen.pares}</p>
        </div>
        {tarjetas.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={filtro === t.id}
            onClick={() => setFiltro(filtro === t.id ? 'todos' : t.id)}
            className={cn('rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground', filtro === t.id && t.id !== 'todos' ? 'border-foreground' : 'border-border')}
          >
            <p className="eyebrow">{t.etiqueta}</p>
            <p className={cn('mt-1 font-display text-4xl font-bold leading-none tabular-nums', t.valor > 0 && t.tono)}>{t.valor}</p>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o color" aria-label="Buscar existencias" />
        </div>
        <div role="group" aria-label="Filtrar por disponibilidad" className="flex flex-wrap gap-1.5">
          {(['todos', 'disponible', 'bajo', 'agotado'] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] transition-colors',
                filtro === f ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {f === 'todos' ? 'Todos' : ETIQUETA[f].texto}
            </button>
          ))}
        </div>
      </div>

      {filas.length === 0 ? (
        <EmptyState title="Sin resultados" description={productos.length === 0 ? 'Registra un ingreso para que aparezcan aquí.' : 'Prueba con otra búsqueda o quita el filtro.'} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filas.map((p) => (
            <li key={p.productoId}>
              <button
                type="button"
                onClick={() => setAbierto(p.productoId)}
                aria-label={`${p.producto}: ${plural(p.total, 'par', 'pares')}. Ver tallas`}
                className="flex w-full items-center gap-4 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-foreground"
              >
                <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                  {fotos[p.productoId] ? <img src={fotos[p.productoId]} alt="" loading="lazy" decoding="async" className="size-full object-cover" /> : <PackagePlus aria-hidden className="size-6 text-muted-foreground" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.producto}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {plural(p.colores.length, 'color', 'colores')} · {p.tallasConStock} de {plural(p.tallasTotal, 'talla', 'tallas')} con stock
                  </span>
                  <span className="mt-1.5 block"><Badge variant={ETIQUETA[p.estado].variante}>{ETIQUETA[p.estado].texto}</Badge></span>
                </span>
                <span className="text-right">
                  <span className={cn('block font-display text-4xl font-bold leading-none tabular-nums', p.estado === 'agotado' && 'text-muted-foreground')}>{p.total}</span>
                  <span className="text-xs text-muted-foreground">{p.total === 1 ? 'par' : 'pares'}</span>
                </span>
                <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!detalle} onOpenChange={cerrar}>
        {detalle && (
          <DialogContent
            title={objetivo ? 'Ajustar stock' : detalle.producto}
            description={
              objetivo
                ? `${detalle.producto} · ${objetivo.color} · talla ${objetivo.talla}. Stock actual: ${objetivo.stock}.`
                : `${plural(detalle.total, 'par', 'pares')} en ${plural(detalle.colores.length, 'color', 'colores')}. Toca una talla para ajustar su stock.`
            }
            className="max-h-[88dvh] max-w-2xl overflow-y-auto"
          >
            {objetivo ? (
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
                  <Button variant="ghost" onClick={() => setObjetivo(null)}>Volver a las tallas</Button>
                  <Button disabled={ajustar.isPending} onClick={() => void confirmar()}>Aplicar ajuste</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {detalle.colores.map((c) => (
                  <section key={c.color} aria-label={`Color ${c.color}`}>
                    <h3 className="mb-2 flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
                      <span className="font-display text-2xl font-bold uppercase">{c.color}</span>
                      <span className="text-sm text-muted-foreground tabular-nums">{plural(c.total, 'par', 'pares')}</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {c.tallas.map((t) => <Talla key={t.id} e={t} onClick={() => ajustarTalla(t)} />)}
                    </div>
                  </section>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <Link to={`/admin/inventario?tab=ingreso&producto=${detalle.productoId}`} className="text-sm underline underline-offset-4 hover:text-foreground" onClick={() => setAbierto(null)}>
                    Ingresar mercancía de este producto
                  </Link>
                  <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function orden(p: ProductoStock): number {
  return p.estado === 'agotado' ? 0 : p.estado === 'bajo' ? 1 : 2
}

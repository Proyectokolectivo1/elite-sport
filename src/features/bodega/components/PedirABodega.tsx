import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { TOPE_MAYORISTA } from '@/features/tienda/carrito/carritoStore'
import { obtenerCatalogoPublico, type ProductoPublico } from '@/features/tienda/api/tienda'
import { agregarLinea, unidadesVenta, type LineaVenta } from '@/features/ventas/ventaLogica'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useSolicitarABodega } from '../hooks/useBodega'
import { notaPedidoSchema, type NotaPedidoValues } from '../schemas'
import { FotoPar } from './FotoPar'

/**
 * Elige productos y tallas disponibles en bodega y envía el pedido. No muestra cuántos pares hay.
 * Con `conPrecio` (vendedor del local) cada línea lleva su precio de venta, que parte del precio de la página.
 */
export function PedirABodega({ onEnviado, conPrecio = false }: { onEnviado?: () => void; conPrecio?: boolean }) {
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const { data: catalogo = [], isLoading } = useQuery({ queryKey: ['catalogo-publico'], queryFn: obtenerCatalogoPublico })
  const solicitar = useSolicitarABodega()
  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const [color, setColor] = useState('')
  const [lineas, setLineas] = useState<LineaVenta[]>([])
  const [errorPrecio, setErrorPrecio] = useState<string | null>(null)
  const referencias = useMemo(() => new Map(catalogo.flatMap((p) => p.variantes.map((v) => [v.id, p.pvp] as const))), [catalogo])
  const { register, handleSubmit, reset, formState: { errors } } = useForm<NotaPedidoValues>({ resolver: zodResolver(notaPedidoSchema), defaultValues: { nota: '' } })

  const productos = useMemo(() => {
    const t = q.trim().toLowerCase()
    return catalogo.filter((p) => p.variantes.some((v) => v.disponible) && (!t || `${p.nombre} ${p.marca?.nombre ?? ''}`.toLowerCase().includes(t)))
  }, [catalogo, q])
  const producto: ProductoPublico | undefined = catalogo.find((p) => p.id === elegido)
  const colores = producto ? [...new Set(producto.variantes.map((v) => v.color))] : []
  const colorActivo = color && colores.includes(color) ? color : (colores[0] ?? '')
  const variantes = producto ? producto.variantes.filter((v) => v.color === colorActivo) : []

  function agregar(v: ProductoPublico['variantes'][number]) {
    if (!producto) return
    setLineas((l) => agregarLinea(l, { varianteId: v.id, nombre: producto.nombre, color: v.color, talla: v.talla, precio: conPrecio ? producto.pvp : 0, stock: v.disponible ? TOPE_MAYORISTA : 0 }))
  }
  const cambiar = (id: string, cantidad: number) => setLineas((l) => l.map((x) => (x.varianteId === id ? { ...x, cantidad } : x)))
  const cambiarPrecio = (id: string, precio: number) => setLineas((l) => l.map((x) => (x.varianteId === id ? { ...x, precio } : x)))

  function onSubmit(v: NotaPedidoValues) {
    if (lineas.length === 0) return
    if (conPrecio && lineas.some((l) => !Number.isFinite(l.precio) || l.precio < 0)) {
      setErrorPrecio('Revisa los precios: hay uno vacío o no válido.')
      return
    }
    setErrorPrecio(null)
    solicitar.mutate(
      { items: lineas.map((l) => ({ varianteId: l.varianteId, cantidad: l.cantidad, ...(conPrecio && { precio: l.precio }) })), nota: v.nota },
      {
        onSuccess: (r) => {
          toast.success(`Pedido #${r.numero} enviado a bodega`)
          setLineas([])
          reset({ nota: '' })
          onEnviado?.()
        },
        onError: (e) => toast.error(mensajeError(e)),
      },
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <section aria-label="Productos en bodega">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o marca" aria-label="Buscar producto en bodega" className="mb-4" />
        {isLoading ? <Skeleton className="h-48 w-full" /> : productos.length === 0 ? (
          <EmptyState title="Sin resultados" description="No hay productos con stock que coincidan." />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {productos.map((p) => {
              const colores = new Set(p.variantes.filter((v) => v.disponible).map((v) => v.color)).size
              return (
                <li key={p.id}>
                  <button type="button" aria-pressed={elegido === p.id} onClick={() => { setElegido(p.id); setColor('') }}
                    className={cn('flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors', elegido === p.id ? 'border-foreground bg-card' : 'border-border hover:border-foreground')}>
                    <FotoPar src={p.imagenes[0] ? (p.imagenes[0].miniatura ?? p.imagenes[0].url) : null} className="size-20" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.nombre}</span>
                      <span className="block text-xs text-muted-foreground">{p.marca?.nombre ?? (colores === 1 ? '1 color' : `${colores} colores`)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {producto && (
          <div className="mt-6 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-4">
              <FotoPar src={(() => { const i = producto.imagenes.find((x) => x.color === colorActivo) ?? producto.imagenes[0]; return i ? (i.miniatura ?? i.url) : null })()} alt={`${producto.nombre} ${colorActivo}`} className="size-28 sm:size-36" />
              <div>
                <h2 className="text-2xl">{producto.nombre}</h2>
                <p className="text-sm text-muted-foreground">{colorActivo}</p>
              </div>
            </div>
            {colores.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {colores.map((c) => (
                  <button key={c} type="button" aria-pressed={colorActivo === c} onClick={() => setColor(c)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold', colorActivo === c ? 'border-foreground bg-foreground text-background' : 'border-input')}>{c}</button>
                ))}
              </div>
            )}
            <p className="mt-4 mb-2 text-sm text-muted-foreground">Toca una talla para sumar un par.</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {variantes.map((v) => {
                const pedidos = lineas.find((l) => l.varianteId === v.id)?.cantidad ?? 0
                return (
                  <button key={v.id} type="button" disabled={!v.disponible} onClick={() => agregar(v)} aria-label={`Talla ${v.talla}${v.disponible ? '' : ', agotada'}`}
                    className="relative h-14 rounded-lg border border-input text-base font-semibold tabular-nums transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40">
                    {v.talla}
                    {pedidos > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-signal px-1 text-[0.6875rem] font-bold text-signal-foreground">{pedidos}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label="Pedido a bodega" className="self-start rounded-xl border border-border bg-card p-4 lg:sticky lg:top-24">
        <h2 className="text-3xl">Tu pedido</h2>
        {lineas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Elige un producto y toca sus tallas.</p> : (
          <ul className="mt-3 divide-y divide-border">
            {lineas.map((l) => (
              <li key={l.varianteId} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <p className="min-w-0 text-sm font-semibold">{l.nombre}<span className="block text-xs font-normal text-muted-foreground">{l.color} · talla {l.talla}</span></p>
                <div className="flex items-center gap-1">
                  <div className="inline-flex items-center rounded-lg border border-input">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Menos" disabled={l.cantidad <= 1} onClick={() => cambiar(l.varianteId, l.cantidad - 1)}><Minus /></Button>
                    <span className="w-8 text-center text-sm tabular-nums">{l.cantidad}</span>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Más" disabled={l.cantidad >= l.stock} onClick={() => cambiar(l.varianteId, l.cantidad + 1)}><Plus /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${l.nombre}`} onClick={() => setLineas((x) => x.filter((y) => y.varianteId !== l.varianteId))}><Trash2 /></Button>
                </div>
                {conPrecio && (
                  <label className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      Precio c/u
                      {referencias.get(l.varianteId) !== undefined && <span className="block">Referencia {fmt(referencias.get(l.varianteId) ?? 0)}</span>}
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      aria-label={`Precio de venta de ${l.nombre} talla ${l.talla}`}
                      className="h-9 w-28 text-right"
                      value={Number.isFinite(l.precio) ? l.precio : ''}
                      onChange={(e) => cambiarPrecio(l.varianteId, e.target.value === '' ? Number.NaN : Number(e.target.value))}
                    />
                  </label>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground"><strong className="text-foreground tabular-nums">{unidadesVenta(lineas)}</strong> pares</p>
        <FieldError>{errorPrecio ?? undefined}</FieldError>
        <div className="mt-3">
          <Label htmlFor="pb-nota">Nota para bodega</Label>
          <Textarea id="pb-nota" className="min-h-16" {...register('nota')} />
          <FieldError>{errors.nota?.message}</FieldError>
        </div>
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={solicitar.isPending || lineas.length === 0}>
          {solicitar.isPending ? 'Enviando…' : 'Enviar pedido a bodega'}
        </Button>
      </form>
    </div>
  )
}

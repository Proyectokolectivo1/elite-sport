import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { obtenerCatalogoPublico, type ProductoPublico } from '@/features/tienda/api/tienda'
import { useAccionPedido, usePedidos } from '@/features/pedidos/hooks/usePedidos'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { MetodoPago } from '../api/ventas'
import { useRegistrarVenta } from '../hooks/useVentas'
import { agregarLinea, totalVenta, unidadesVenta, type LineaVenta } from '../ventaLogica'

const PAGOS: { id: MetodoPago; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
]

const hora = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })

export function VentasPage() {
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const { data: catalogo = [], isLoading } = useQuery({ queryKey: ['catalogo-publico'], queryFn: obtenerCatalogoPublico })
  const { data: pedidos = [] } = usePedidos()
  const registrar = useRegistrarVenta()
  const accion = useAccionPedido()
  const [hoy] = useState(() => new Date().toDateString())

  const [q, setQ] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const [color, setColor] = useState('')
  const [lineas, setLineas] = useState<LineaVenta[]>([])
  const [pago, setPago] = useState<MetodoPago>('efectivo')
  const [cliente, setCliente] = useState({ nombre: '', documento: '', telefono: '', correo: '' })
  const [conCliente, setConCliente] = useState(false)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productos = useMemo(() => {
    const t = q.trim().toLowerCase()
    return catalogo.filter((p) => !t || `${p.nombre} ${p.marca?.nombre ?? ''}`.toLowerCase().includes(t))
  }, [catalogo, q])
  const producto: ProductoPublico | undefined = catalogo.find((p) => p.id === elegido)
  const colores = producto ? [...new Set(producto.variantes.map((v) => v.color))] : []
  const colorActivo = color && colores.includes(color) ? color : (colores[0] ?? '')
  const variantes = producto ? producto.variantes.filter((v) => v.color === colorActivo) : []

  const total = totalVenta(lineas)
  const ventasHoy = pedidos.filter((p) => p.tipo === 'mostrador' && new Date(p.creadoEn).toDateString() === hoy)
  const totalHoy = ventasHoy.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0)

  function agregar(v: ProductoPublico['variantes'][number]) {
    if (!producto) return
    setLineas((l) => agregarLinea(l, { varianteId: v.id, nombre: producto.nombre, color: v.color, talla: v.talla, precio: producto.pvp, stock: v.stock }))
  }
  const cambiar = (id: string, parcial: Partial<LineaVenta>) => setLineas((l) => l.map((x) => (x.varianteId === id ? { ...x, ...parcial } : x)))

  function validar(): string | null {
    if (lineas.length === 0) return 'Agrega al menos un producto.'
    if (lineas.some((l) => !Number.isFinite(l.precio) || l.precio < 0)) return 'Hay un precio no válido.'
    if (cliente.documento && !/^([0-9]{10}|[0-9]{13})$/.test(cliente.documento.trim())) return 'La cédula o el RUC deben tener 10 o 13 dígitos.'
    if (cliente.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cliente.correo.trim())) return 'El correo no es válido.'
    return null
  }

  async function cobrar() {
    const msg = validar()
    setError(msg)
    if (msg) return
    try {
      const r = await registrar.mutateAsync({
        items: lineas.map((l) => ({ variante_id: l.varianteId, cantidad: l.cantidad, precio: l.precio })),
        metodoPago: pago,
        nombre: cliente.nombre.trim(),
        telefono: cliente.telefono.trim(),
        correo: cliente.correo.trim(),
        documento: cliente.documento.trim(),
        nota: nota.trim(),
      })
      toast.success(`Venta #${r.numero} registrada por ${fmt(r.total)}. Inventario actualizado.`)
      setLineas([])
      setCliente({ nombre: '', documento: '', telefono: '', correo: '' })
      setConCliente(false)
      setNota('')
      setPago('efectivo')
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <>
      <PageHeader title="Ventas en tienda" description="Registra las ventas del punto físico. Cada venta descuenta el inventario al instante y queda en Pedidos." />

      <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
        <section aria-label="Productos">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o marca" aria-label="Buscar producto" className="mb-4" />
          {isLoading ? <Skeleton className="h-48 w-full" /> : productos.length === 0 ? (
            <EmptyState title="Sin resultados" description="Prueba con otro nombre." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {productos.map((p) => {
                const stock = p.variantes.reduce((s, v) => s + v.stock, 0)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      aria-pressed={elegido === p.id}
                      onClick={() => { setElegido(p.id); setColor('') }}
                      className={cn('flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors', elegido === p.id ? 'border-foreground bg-card' : 'border-border hover:border-foreground')}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">{p.imagenes[0] && <img src={p.imagenes[0].miniatura ?? p.imagenes[0].url} alt="" className="size-full object-cover" loading="lazy" decoding="async" width={96} height={96} />}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{p.nombre}</span>
                          <span className="block text-xs text-muted-foreground">{fmt(p.pvp)} · {stock === 0 ? 'agotado' : `${stock} pares`}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {producto && (
            <div className="mt-6 rounded-xl border border-border bg-card p-4">
              <h2 className="text-2xl">{producto.nombre}</h2>
              {colores.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Este producto aún no tiene inventario.</p> : (
                <>
                  {colores.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {colores.map((c) => (
                        <button key={c} type="button" aria-pressed={colorActivo === c} onClick={() => setColor(c)} className={cn('h-9 rounded-lg border px-3 text-sm font-semibold', colorActivo === c ? 'border-foreground bg-foreground text-background' : 'border-input')}>{c}</button>
                      ))}
                    </div>
                  )}
                  <p className="mt-4 mb-2 text-sm text-muted-foreground">Toca una talla para agregar un par.</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {variantes.map((v) => {
                      const enVenta = lineas.find((l) => l.varianteId === v.id)?.cantidad ?? 0
                      const sinStock = v.stock - enVenta <= 0
                      return (
                        <button key={v.id} type="button" disabled={sinStock} onClick={() => agregar(v)} className="relative h-14 rounded-lg border border-input text-base font-semibold tabular-nums transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Talla ${v.talla}, quedan ${v.stock - enVenta}`}>
                          {v.talla}
                          <span className="block text-[0.6875rem] font-normal text-muted-foreground">{v.stock - enVenta}</span>
                          {enVenta > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-signal px-1 text-[0.6875rem] font-bold text-signal-foreground">{enVenta}</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </section>

        <aside aria-label="Venta actual" className="self-start rounded-xl border border-border bg-card p-4 lg:sticky lg:top-24">
          <h2 className="text-3xl">Venta actual</h2>
          {lineas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Aún no hay productos. Elige uno y toca su talla.</p> : (
            <ul className="mt-3 divide-y divide-border">
              {lineas.map((l) => (
                <li key={l.varianteId} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold">{l.nombre}<span className="block text-xs font-normal text-muted-foreground">{l.color} · talla {l.talla}</span></p>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${l.nombre}`} onClick={() => setLineas((x) => x.filter((y) => y.varianteId !== l.varianteId))}><Trash2 /></Button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-lg border border-input">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Menos" disabled={l.cantidad <= 1} onClick={() => cambiar(l.varianteId, { cantidad: l.cantidad - 1 })}><Minus /></Button>
                      <span className="w-8 text-center text-sm tabular-nums">{l.cantidad}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Más" disabled={l.cantidad >= l.stock} onClick={() => cambiar(l.varianteId, { cantidad: l.cantidad + 1 })}><Plus /></Button>
                    </div>
                    <Input aria-label={`Precio unitario de ${l.nombre}`} type="number" step="0.01" min="0" inputMode="decimal" className="h-9 w-28 text-right" value={Number.isFinite(l.precio) ? l.precio : ''} onChange={(e) => cambiar(l.varianteId, { precio: e.target.value === '' ? Number.NaN : Number(e.target.value) })} />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{unidadesVenta(lineas)} pares</span>
            <span className="font-display text-4xl font-bold tabular-nums">{fmt(total)}</span>
          </div>

          <fieldset className="mt-4">
            <legend className="eyebrow mb-2">Forma de pago</legend>
            <div role="radiogroup" className="grid grid-cols-3 gap-2">
              {PAGOS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={pago === p.id} onClick={() => setPago(p.id)} className={cn('h-11 rounded-lg border text-sm font-semibold', pago === p.id ? 'border-foreground bg-foreground text-background' : 'border-input')}>{p.label}</button>
              ))}
            </div>
          </fieldset>

          <button type="button" aria-expanded={conCliente} onClick={() => setConCliente((c) => !c)} className="mt-4 text-sm underline underline-offset-4">
            {conCliente ? 'Quitar datos del cliente' : 'Agregar datos del cliente (opcional)'}
          </button>
          {conCliente && (
            <div className="mt-3 space-y-3">
              <div><Label htmlFor="v-nombre">Nombre</Label><Input id="v-nombre" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} /></div>
              <div><Label htmlFor="v-doc">Cédula o RUC</Label><Input id="v-doc" inputMode="numeric" value={cliente.documento} onChange={(e) => setCliente({ ...cliente, documento: e.target.value })} /></div>
              <div><Label htmlFor="v-tel">Celular</Label><Input id="v-tel" type="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} /></div>
              <div><Label htmlFor="v-correo">Correo</Label><Input id="v-correo" type="email" value={cliente.correo} onChange={(e) => setCliente({ ...cliente, correo: e.target.value })} /></div>
            </div>
          )}
          <div className="mt-3"><Label htmlFor="v-nota">Nota</Label><Textarea id="v-nota" className="min-h-16" value={nota} onChange={(e) => setNota(e.target.value)} /></div>

          <FieldError>{error ?? undefined}</FieldError>
          <Button size="lg" className="mt-4 w-full" disabled={registrar.isPending || lineas.length === 0} onClick={() => void cobrar()}>
            {registrar.isPending ? 'Registrando…' : `Registrar venta ${lineas.length ? fmt(total) : ''}`}
          </Button>
        </aside>
      </div>

      <section className="mt-12" aria-label="Ventas de hoy">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl">Ventas de hoy</h2>
          <p className="text-sm text-muted-foreground">{ventasHoy.filter((p) => p.estado !== 'cancelado').length} ventas · <strong className="text-foreground tabular-nums">{fmt(totalHoy)}</strong></p>
        </div>
        {ventasHoy.length === 0 ? <EmptyState title="Aún no hay ventas hoy" description="Las ventas del punto físico aparecerán aquí." /> : (
          <Table>
            <THead><TR><TH>N.°</TH><TH>Hora</TH><TH>Cliente</TH><TH>Pago</TH><TH className="text-right">Total</TH><TH>Estado</TH><TH><span className="sr-only">Acciones</span></TH></TR></THead>
            <TBody>
              {ventasHoy.map((p) => (
                <TR key={p.id}>
                  <TD className="font-semibold tabular-nums">#{p.numero}</TD>
                  <TD className="whitespace-nowrap">{hora.format(new Date(p.creadoEn))}</TD>
                  <TD>{p.cliente}</TD>
                  <TD className="capitalize">{p.metodoPago ?? ''}</TD>
                  <TD className="text-right font-semibold tabular-nums">{fmt(p.total)}</TD>
                  <TD>{p.estado === 'cancelado' ? <Badge>Anulada</Badge> : <Badge variant="success">Cobrada</Badge>}</TD>
                  <TD className="text-right">
                    {p.estado !== 'cancelado' && (
                      <Button size="sm" variant="outline" disabled={accion.isPending} onClick={() => accion.mutate({ accion: 'cancelar', id: p.id }, { onSuccess: () => toast.success('Venta anulada. Inventario repuesto.'), onError: (e) => toast.error(mensajeError(e)) })}>Anular</Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  )
}

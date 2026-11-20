import { useMemo, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import type { ParEnPoder } from '@/features/bodega/api/bodega'
import { FotoPar } from '@/features/bodega/components/FotoPar'
import { useFotosPares, useMisParesEnPoder, useMisVentasHoy, useRegistrarVentaLocal } from '@/features/bodega/hooks/useBodega'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import type { MetodoPago } from '../api/ventas'
import { agregarLinea, totalVenta, unidadesVenta, type LineaVenta } from '../ventaLogica'

const PAGOS: { id: MetodoPago; label: string }[] = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'tarjeta', label: 'Tarjeta' },
]
const hora = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })

/** Venta del local con los pares que el vendedor tiene en su poder. No toca el inventario central. */
export function VenderLocalPage() {
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const { data: pares = [], isLoading } = useMisParesEnPoder()
  const { data: ventas = [] } = useMisVentasHoy()
  const registrar = useRegistrarVentaLocal()
  const foto = useFotosPares()

  const [q, setQ] = useState('')
  const [lineas, setLineas] = useState<LineaVenta[]>([])
  const [pago, setPago] = useState<MetodoPago>('efectivo')
  const [cliente, setCliente] = useState({ nombre: '', documento: '', telefono: '', correo: '' })
  const [conCliente, setConCliente] = useState(false)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  const productos = useMemo(() => {
    const t = q.trim().toLowerCase()
    const m = new Map<string, { nombre: string; pares: ParEnPoder[] }>()
    for (const p of pares) {
      if (t && !`${p.producto} ${p.color}`.toLowerCase().includes(t)) continue
      const g = m.get(p.producto_id) ?? { nombre: p.producto, pares: [] }
      g.pares.push(p)
      m.set(p.producto_id, g)
    }
    return [...m.entries()]
  }, [pares, q])

  const parDe = useMemo(() => new Map(pares.map((p) => [p.variante_id, p])), [pares])
  const fotoDeLinea = (varianteId: string) => {
    const p = parDe.get(varianteId)
    return p ? foto(p.producto_id, p.color) : null
  }
  const total = totalVenta(lineas)
  const listaDe = (varianteId: string) => parDe.get(varianteId)?.precio ?? null

  function agregar(p: ParEnPoder) {
    setLineas((l) => agregarLinea(l, { varianteId: p.variante_id, nombre: p.producto, color: p.color, talla: p.talla, precio: p.precio, stock: p.en_poder }))
  }
  const cambiar = (id: string, parcial: Partial<LineaVenta>) => setLineas((l) => l.map((x) => (x.varianteId === id ? { ...x, ...parcial } : x)))

  function validar(): string | null {
    if (lineas.length === 0) return 'Agrega al menos un par.'
    if (lineas.some((l) => !Number.isFinite(l.precio) || l.precio < 0)) return 'Revisa los precios: hay uno vacío o no válido.'
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
      toast.success(`Venta #${r.numero} enviada al administrador para el cierre`)
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
      <PageHeader title="Vender" description="Arma la venta con los pares que tienes en tu poder. Puedes ajustar el precio según la cantidad o el cliente; luego envíala a cierre y el administrador la cierra." />

      <div className="grid gap-8 lg:grid-cols-[1fr_26rem]">
        <section aria-label="Pares en tu poder">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto o color" aria-label="Buscar en tu mercancía" className="mb-4" />
          {isLoading ? <Skeleton className="h-48 w-full" /> : productos.length === 0 ? (
            <EmptyState title="No tienes pares para vender" description="Pide mercancía a bodega desde Mi mercancía." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] gap-4">
              {productos.flatMap(([id, g]) => {
                const colores = [...new Set(g.pares.map((p) => p.color))]
                return colores.map((color) => {
                  const pares = g.pares.filter((p) => p.color === color)
                  return (
                    <article key={`${id}-${color}`} aria-label={`${g.nombre}, ${color}`} className="flex gap-4 rounded-xl border border-border bg-card p-3">
                      <FotoPar src={foto(id, color)} alt={`${g.nombre} ${color}`} className="size-32 sm:size-40" />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-2xl leading-tight">{g.nombre}</h2>
                        <p className="text-sm text-muted-foreground">{color}</p>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {pares.map((p) => {
                            const enVenta = lineas.find((l) => l.varianteId === p.variante_id)?.cantidad ?? 0
                            const libres = p.en_poder - enVenta
                            return (
                              <button key={p.variante_id} type="button" disabled={libres <= 0} onClick={() => agregar(p)} aria-label={`${p.color} talla ${p.talla}, quedan ${libres}`}
                                className="relative rounded-lg border border-input px-2 py-2 text-center transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40">
                                <span className="block text-lg font-semibold tabular-nums leading-none">{p.talla}</span>
                                <span className="mt-1 block text-[0.6875rem] text-muted-foreground">quedan {libres}</span>
                                {enVenta > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-signal px-1 text-[0.6875rem] font-bold text-signal-foreground">{enVenta}</span>}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </article>
                  )
                })
              })}
            </div>
          )}
        </section>

        <aside aria-label="Venta actual" className="self-start rounded-xl border border-border bg-card p-4 lg:sticky lg:top-24">
          <h2 className="text-3xl">Venta actual</h2>
          {lineas.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Toca una talla para agregar un par.</p> : (
            <ul className="mt-3 divide-y divide-border">
              {lineas.map((l) => (
                <li key={l.varianteId} className="space-y-2 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <FotoPar src={fotoDeLinea(l.varianteId)} className="size-16" />
                    <p className="min-w-0 flex-1 text-sm font-semibold">{l.nombre}<span className="block text-xs font-normal text-muted-foreground">{l.color} · talla {l.talla}</span></p>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${l.nombre}`} onClick={() => setLineas((x) => x.filter((y) => y.varianteId !== l.varianteId))}><Trash2 /></Button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center rounded-lg border border-input">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Menos" disabled={l.cantidad <= 1} onClick={() => cambiar(l.varianteId, { cantidad: l.cantidad - 1 })}><Minus /></Button>
                      <span className="w-8 text-center text-sm tabular-nums">{l.cantidad}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Más" disabled={l.cantidad >= l.stock} onClick={() => cambiar(l.varianteId, { cantidad: l.cantidad + 1 })}><Plus /></Button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Precio c/u
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        aria-label={`Precio de venta de ${l.nombre} talla ${l.talla}`}
                        className="h-9 w-24 text-right"
                        value={Number.isFinite(l.precio) ? l.precio : ''}
                        onChange={(e) => cambiar(l.varianteId, { precio: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <p className="flex justify-between text-xs text-muted-foreground">
                    <span>{listaDe(l.varianteId) !== null && listaDe(l.varianteId) !== l.precio ? `Lista ${fmt(listaDe(l.varianteId) ?? 0)}` : 'Precio de lista'}</span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">{Number.isFinite(l.precio) ? fmt(l.precio * l.cantidad) : '—'}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{unidadesVenta(lineas)} pares</span>
            <span className="font-display text-4xl font-bold tabular-nums">{Number.isFinite(total) ? fmt(total) : '—'}</span>
          </div>

          <fieldset className="mt-4">
            <legend className="eyebrow mb-2">Forma de pago que indica el cliente</legend>
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
              <div><Label htmlFor="vl-nombre">Nombre</Label><Input id="vl-nombre" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} /></div>
              <div><Label htmlFor="vl-doc">Cédula o RUC</Label><Input id="vl-doc" inputMode="numeric" value={cliente.documento} onChange={(e) => setCliente({ ...cliente, documento: e.target.value })} /></div>
              <div><Label htmlFor="vl-tel">Celular</Label><Input id="vl-tel" type="tel" value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} /></div>
              <div><Label htmlFor="vl-correo">Correo</Label><Input id="vl-correo" type="email" value={cliente.correo} onChange={(e) => setCliente({ ...cliente, correo: e.target.value })} /></div>
            </div>
          )}
          <div className="mt-3"><Label htmlFor="vl-nota">Nota</Label><Textarea id="vl-nota" className="min-h-16" value={nota} onChange={(e) => setNota(e.target.value)} /></div>

          <FieldError>{error ?? undefined}</FieldError>
          <Button size="lg" className="mt-4 w-full" disabled={registrar.isPending || lineas.length === 0} onClick={() => void cobrar()}>
            {registrar.isPending ? 'Enviando…' : 'Enviar a cierre'}
          </Button>
        </aside>
      </div>

      <section className="mt-12" aria-label="Mis ventas de hoy">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl">Mis ventas de hoy</h2>
          <p className="text-sm text-muted-foreground">Los totales del día los lleva el administrador.</p>
        </div>
        {ventas.length === 0 ? <EmptyState title="Aún no hay ventas hoy" description="Tus ventas del local aparecerán aquí." /> : (
          <Table>
            <THead><TR><TH>N.°</TH><TH>Hora</TH><TH>Cliente</TH><TH>Pago</TH><TH className="text-right">Total</TH><TH>Estado</TH></TR></THead>
            <TBody>
              {ventas.map((v) => (
                <TR key={v.id}>
                  <TD className="font-semibold tabular-nums">#{v.numero}</TD>
                  <TD className="whitespace-nowrap">{hora.format(new Date(v.creadoEn))}</TD>
                  <TD>{v.cliente}</TD>
                  <TD className="capitalize">{v.metodoPago ?? ''}</TD>
                  <TD className="text-right font-semibold tabular-nums">{fmt(v.total)}</TD>
                  <TD>{v.estado === 'cancelado' ? <Badge>Anulada</Badge> : v.estado === 'nuevo' ? <Badge variant="warning">Por cerrar</Badge> : <Badge variant="success">Cerrada</Badge>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  )
}

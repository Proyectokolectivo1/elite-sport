import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input, Label, Textarea } from '@/components/ui/input'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toast'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { crearPedidoPublico } from '../api/tienda'
import { totalCarrito, useCarritoStore, type ItemCarrito } from '../carrito/carritoStore'
import { useStore } from '../context/StoreContext'
import { construirMensaje, urlWhatsApp } from '../whatsapp'

const schema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa tu nombre'),
  telefono: z.string().trim().regex(/^[0-9+() -]{7,20}$/, 'Ingresa un teléfono válido'),
  nota: z.string().max(500, 'Máximo 500 caracteres'),
})
type Valores = z.infer<typeof schema>

const SIN_ITEMS: ItemCarrito[] = []

interface Enviado {
  numero: number
  url: string | null
}

export function CarritoSheet() {
  const { clave, tienda, esPrincipal, whatsapp, carritoAbierto, setCarritoAbierto } = useStore()
  const items = useCarritoStore((s) => s.porTienda[clave]) ?? SIN_ITEMS
  const { cambiarCantidad, quitar, vaciar } = useCarritoStore.getState()
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const [enviado, setEnviado] = useState<Enviado | null>(null)
  const [enviando, setEnviando] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Valores>({ resolver: zodResolver(schema), defaultValues: { nombre: '', telefono: '', nota: '' } })

  async function onSubmit(v: Valores) {
    setEnviando(true)
    try {
      const r = await crearPedidoPublico({
        tiendaId: tienda.id,
        esPrincipal,
        nombre: v.nombre,
        telefono: v.telefono,
        nota: v.nota,
        items: items.map((i) => ({ variante_id: i.varianteId, cantidad: i.cantidad })),
      })
      const mensaje = construirMensaje({
        plantilla: tienda.plantilla_mensaje,
        numero: r.numero,
        nombre: v.nombre,
        telefono: v.telefono,
        nota: v.nota,
        lineas: items.map((i) => ({ descripcion: `${i.nombre} · ${i.color} · talla ${i.talla}`, cantidad: i.cantidad, precio: i.precio })),
        total: r.total,
        formato: fmt,
      })
      const url = whatsapp ? urlWhatsApp(whatsapp, mensaje) : null
      vaciar(clave)
      setEnviado({ numero: r.numero, url })
      if (url) window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(mensajeError(e))
    } finally {
      setEnviando(false)
    }
  }

  function cerrar(abierto: boolean) {
    setCarritoAbierto(abierto)
    if (!abierto) setEnviado(null)
  }

  return (
    <Sheet open={carritoAbierto} onOpenChange={cerrar}>
      <SheetContent title={enviado ? 'Pedido enviado' : 'Tu carrito'} description={enviado ? undefined : `${items.length} ${items.length === 1 ? 'producto' : 'productos'}`}>
        {enviado ? (
          <div className="space-y-4">
            <p>Registramos tu pedido <strong>#{enviado.numero}</strong>.</p>
            {enviado.url ? (
              <>
                <p className="text-sm text-muted-foreground">Si WhatsApp no se abrió solo, toca el botón para enviarlo a la tienda y confirmar tallas y entrega.</p>
                <a href={enviado.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 w-full items-center justify-center rounded-md bg-signal px-8 text-sm font-semibold uppercase tracking-[0.08em] text-signal-foreground">
                  Abrir WhatsApp
                </a>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">La tienda se pondrá en contacto contigo al número que indicaste.</p>
            )}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Aún no hay productos" description="Elige una talla y agrégala para armar tu pedido." />
        ) : (
          <form id="form-pedido" noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.varianteId} className="flex gap-3 py-4 first:pt-0">
                  <div className="size-20 shrink-0 overflow-hidden rounded-md bg-muted">{i.imagen && <img src={i.imagen} alt="" className="size-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.nombre}</p>
                    <p className="text-sm text-muted-foreground">{i.color} · talla {i.talla}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-md border border-input">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Menos" disabled={i.cantidad <= 1} onClick={() => cambiarCantidad(clave, i.varianteId, i.cantidad - 1)}><Minus /></Button>
                        <span className="w-8 text-center text-sm tabular-nums" aria-live="polite">{i.cantidad}</span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="Más" disabled={i.cantidad >= i.stock} onClick={() => cambiarCantidad(clave, i.varianteId, i.cantidad + 1)}><Plus /></Button>
                      </div>
                      <span className="font-display text-xl font-bold tabular-nums">{fmt(i.precio * i.cantidad)}</span>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${i.nombre}`} onClick={() => quitar(clave, i.varianteId)}><Trash2 /></Button>
                </li>
              ))}
            </ul>

            <div className="space-y-4 border-t border-border pt-5">
              <h3 className="text-2xl">Tus datos</h3>
              <div>
                <Label htmlFor="c-nombre">Nombre</Label>
                <Input id="c-nombre" autoComplete="name" aria-invalid={!!errors.nombre} {...register('nombre')} />
                <FieldError>{errors.nombre?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="c-tel">Teléfono</Label>
                <Input id="c-tel" type="tel" autoComplete="tel" inputMode="tel" aria-invalid={!!errors.telefono} {...register('telefono')} />
                <FieldError>{errors.telefono?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="c-nota">Nota (opcional)</Label>
                <Textarea id="c-nota" className="min-h-20" {...register('nota')} />
                <FieldError>{errors.nota?.message}</FieldError>
              </div>
            </div>
          </form>
        )}
        {!enviado && items.length > 0 && (
          <div className="mt-6 flex items-end justify-between border-t border-border pt-4">
            <span className="eyebrow">Total</span>
            <span className="font-display text-4xl font-bold tabular-nums">{fmt(totalCarrito(items))}</span>
          </div>
        )}
        {!enviado && items.length > 0 && (
          <Button type="submit" form="form-pedido" size="lg" className="mt-4 w-full" disabled={enviando}>
            {enviando ? 'Enviando…' : whatsapp ? 'Enviar pedido por WhatsApp' : 'Enviar pedido'}
          </Button>
        )}
      </SheetContent>
    </Sheet>
  )
}

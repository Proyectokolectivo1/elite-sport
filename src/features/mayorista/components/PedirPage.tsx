import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FieldError, Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Price } from '@/components/ui/price'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { CamposCliente } from '@/features/pedidos/components/CamposCliente'
import { DATOS_CLIENTE_VACIOS, datosClienteSchema, datosDesdePerfil, type DatosCliente } from '@/features/pedidos/datosCliente'
import { useConfiguracion } from '@/features/configuracion/hooks/useConfiguracion'
import { obtenerCatalogoPublico, type ProductoPublico } from '@/features/tienda/api/tienda'
import { totalCarrito, unidadesCarrito, useCarritoStore, type ItemCarrito } from '@/features/tienda/carrito/carritoStore'
import { construirMensaje, urlWhatsApp } from '@/features/tienda/whatsapp'
import { mensajeError } from '@/lib/errors'
import { formatMoney, useMoneyStore } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useCostos, useCrearPedidoMayorista } from '../hooks/useMayorista'
import { costoMayorista } from '../precio'

const CLAVE = 'mayorista'
const SIN_ITEMS: ItemCarrito[] = []

function ElegirTallas({ producto, costo, onCerrar }: { producto: ProductoPublico; costo: number; onCerrar: () => void }) {
  const colores = [...new Set(producto.variantes.map((v) => v.color))]
  const [color, setColor] = useState(colores[0] ?? '')
  const [cant, setCant] = useState<Record<string, string>>({})
  const filas = producto.variantes.filter((v) => v.color === color)
  const total = Object.values(cant).reduce((s, n) => s + (Number(n) || 0), 0)

  function agregar() {
    const { agregar } = useCarritoStore.getState()
    for (const v of producto.variantes) {
      const n = Math.floor(Number(cant[v.id]) || 0)
      if (n > 0 && v.stock > 0) {
        agregar(CLAVE, { varianteId: v.id, productoId: producto.id, nombre: producto.nombre, color: v.color, talla: v.talla, imagen: (producto.imagenes.find((i) => i.color === v.color) ?? producto.imagenes[0])?.miniatura ?? (producto.imagenes.find((i) => i.color === v.color) ?? producto.imagenes[0])?.url ?? null, precio: costo, stock: v.stock }, n)
      }
    }
    toast.success('Agregado a tu pedido')
    onCerrar()
  }

  return (
    <div className="space-y-5">
      {colores.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {colores.map((c) => (
            <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} className={cn('h-10 rounded-md border px-4 text-sm font-semibold', color === c ? 'border-foreground bg-foreground text-background' : 'border-input')}>{c}</button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border">
        {filas.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-3 p-3">
            <span className="tabular-nums"><strong className="text-lg">{v.talla}</strong> <span className="text-sm text-muted-foreground">· {v.stock > 0 ? `${v.stock} disponibles` : 'agotada'}</span></span>
            <Input
              aria-label={`Cantidad talla ${v.talla}`}
              type="number" min="0" max={v.stock} step="1" inputMode="numeric" placeholder="0" disabled={v.stock === 0}
              className="h-10 w-24 text-right"
              value={cant[v.id] ?? ''}
              onChange={(e) => setCant((c) => ({ ...c, [v.id]: String(Math.min(v.stock, Math.max(0, Math.floor(Number(e.target.value) || 0))) || '') }))}
            />
          </li>
        ))}
      </ul>
      <Button className="w-full" size="lg" disabled={total === 0} onClick={agregar}>Agregar {total > 0 ? `${total} pares` : ''} al pedido</Button>
    </div>
  )
}

function RevisarPedido({ abierto, onCambio }: { abierto: boolean; onCambio: (o: boolean) => void }) {
  const items = useCarritoStore((s) => s.porTienda[CLAVE]) ?? SIN_ITEMS
  const { cambiarCantidad, quitar, vaciar } = useCarritoStore.getState()
  const { perfil } = useAuth()
  const { data: config } = useConfiguracion()
  const moneda = useMoneyStore((s) => s.config)
  const fmt = (n: number) => formatMoney(n, moneda)
  const crear = useCrearPedidoMayorista()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<{ numero: number; url: string | null } | null>(null)

  // Los datos del mayorista se rellenan solos desde su cuenta; puede cambiarlos para este pedido.
  const valoresPerfil = useMemo(() => datosDesdePerfil(perfil), [perfil])
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosCliente>({ resolver: zodResolver(datosClienteSchema), defaultValues: DATOS_CLIENTE_VACIOS, values: valoresPerfil })

  async function enviar(v: DatosCliente) {
    setError(null)
    try {
      const r = await crear.mutateAsync({
        nombre: v.nombre,
        telefono: v.telefono,
        correo: v.correo,
        direccion: v.direccion,
        documento: v.documento,
        nota: v.nota,
        items: items.map((i) => ({ variante_id: i.varianteId, cantidad: i.cantidad })),
      })
      const admin = config?.whatsapp_principal
      const url = admin
        ? urlWhatsApp(
            admin,
            construirMensaje({
              plantilla: 'Hola, acabo de enviar un pedido mayorista:',
              numero: r.numero,
              nombre: v.nombre,
              telefono: v.telefono,
              correo: v.correo,
              direccion: v.direccion,
              documento: v.documento,
              nota: v.nota,
              lineas: items.map((i) => ({ descripcion: `${i.nombre} · ${i.color} · talla ${i.talla}`, cantidad: i.cantidad, precio: i.precio })),
              total: r.total,
              formato: fmt,
            }),
          )
        : null
      vaciar(CLAVE)
      setHecho({ numero: r.numero, url })
    } catch (e) {
      setError(mensajeError(e))
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={(o) => { onCambio(o); if (!o) setHecho(null) }}>
      <SheetContent title={hecho ? 'Pedido enviado' : 'Mi pedido'}>
        {hecho ? (
          <div className="space-y-4">
            <p>Tu pedido <strong>#{hecho.numero}</strong> quedó registrado. El administrador lo confirmará y el stock se descuenta en ese momento.</p>
            {hecho.url && <a href={hecho.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 w-full items-center justify-center rounded-md bg-signal px-8 text-sm font-semibold uppercase tracking-[0.08em] text-signal-foreground">Avisar por WhatsApp</a>}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Tu pedido está vacío" description="Elige productos y sus tallas." />
        ) : (
          <form noValidate onSubmit={handleSubmit(enviar)} className="space-y-6">
            <ul className="divide-y divide-border">
              {items.map((i) => (
                <li key={i.varianteId} className="flex items-center gap-3 py-3 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.nombre}</p>
                    <p className="text-sm text-muted-foreground">{i.color} · talla {i.talla} · {fmt(i.precio)} c/u</p>
                  </div>
                  <div className="inline-flex items-center rounded-md border border-input">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Menos" disabled={i.cantidad <= 1} onClick={() => cambiarCantidad(CLAVE, i.varianteId, i.cantidad - 1)}><Minus /></Button>
                    <span className="w-8 text-center text-sm tabular-nums">{i.cantidad}</span>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Más" disabled={i.cantidad >= i.stock} onClick={() => cambiarCantidad(CLAVE, i.varianteId, i.cantidad + 1)}><Plus /></Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${i.nombre}`} onClick={() => quitar(CLAVE, i.varianteId)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
            <div className="space-y-4 border-t border-border pt-5">
              <div>
                <h3 className="text-2xl">Datos del pedido</h3>
                <p className="mt-1 text-sm text-muted-foreground">Vienen de tu cuenta. Cámbialos si este pedido va a otra dirección o a nombre de otra persona.</p>
              </div>
              <CamposCliente register={register} errors={errors} prefijo="pedido" />
            </div>
            <div className="flex items-end justify-between border-t border-border pt-4">
              <span className="eyebrow">Total</span>
              <span className="font-display text-4xl font-bold tabular-nums">{fmt(totalCarrito(items))}</span>
            </div>
            <FieldError>{error ?? undefined}</FieldError>
            <Button type="submit" size="lg" className="w-full" disabled={crear.isPending}>{crear.isPending ? 'Enviando…' : 'Enviar pedido al administrador'}</Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function PedirPage() {
  const { data: catalogo = [], isLoading } = useQuery({ queryKey: ['catalogo-publico'], queryFn: obtenerCatalogoPublico })
  const { data: costos = [] } = useCostos()
  const [elegido, setElegido] = useState<ProductoPublico | null>(null)
  const [revisar, setRevisar] = useState(false)
  const items = useCarritoStore((s) => s.porTienda[CLAVE]) ?? SIN_ITEMS
  const moneda = useMoneyStore((s) => s.config)

  const filas = useMemo(() => {
    const mapa = new Map(costos.map((c) => [c.productoId, costoMayorista(c.base, c.especial)]))
    return catalogo.flatMap((p) => {
      const costo = mapa.get(p.id) ?? null
      return costo === null ? [] : [{ p, costo }]
    })
  }, [catalogo, costos])
  const costoElegido = filas.find((f) => f.p.id === elegido?.id)?.costo ?? 0

  return (
    <>
      <PageHeader title="Pedir mercancía" description="Precio mayorista, sin pedido mínimo. El stock se descuenta cuando el administrador confirma tu pedido." />
      {isLoading ? <Skeleton className="h-64 w-full" /> : filas.length === 0 ? (
        <EmptyState title="Aún no hay productos con precio mayorista" description="El administrador los irá habilitando." />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 pb-24 md:grid-cols-3 lg:grid-cols-4">
          {filas.map(({ p, costo }) => {
            const stock = p.variantes.reduce((s, v) => s + v.stock, 0)
            return (
              <li key={p.id}>
                <button type="button" disabled={stock === 0} onClick={() => setElegido(p)} className="group w-full text-left disabled:opacity-50">
                  <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
                    {p.imagenes[0] && <img src={p.imagenes[0].miniatura ?? p.imagenes[0].url} alt="" loading="lazy" decoding="async" width={400} height={500} className="size-full object-cover transition-transform duration-[var(--dur-slow)] group-hover:scale-[1.03]" />}
                  </div>
                  <p className="mt-2 truncate font-semibold">{p.nombre}</p>
                  <p className="flex items-baseline justify-between text-sm">
                    <span><span className="eyebrow mr-1.5">Tu costo</span><Price amount={costo} size="sm" /></span>
                  </p>
                  <p className="text-xs text-muted-foreground">PVP {formatMoney(p.pvp, moneda)} · {stock === 0 ? 'agotado' : `${stock} pares`}</p>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={!!elegido} onOpenChange={(o) => !o && setElegido(null)}>
        {elegido && (
          <SheetContent title={elegido.nombre} description="Elige las cantidades por talla.">
            <ElegirTallas producto={elegido} costo={costoElegido} onCerrar={() => setElegido(null)} />
          </SheetContent>
        )}
      </Sheet>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-[var(--gutter)] pb-3 md:bottom-0 md:left-auto md:right-0 md:w-auto md:pb-6">
          <Button size="lg" className="w-full shadow-lg" onClick={() => setRevisar(true)}>
            <ShoppingBag /> Mi pedido · {unidadesCarrito(items)} pares · {formatMoney(totalCarrito(items), moneda)}
          </Button>
        </div>
      )}
      <RevisarPedido abierto={revisar} onCambio={setRevisar} />
    </>
  )
}

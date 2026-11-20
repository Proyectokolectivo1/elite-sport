import { z } from 'zod'
import { aFechaInput } from './logica'

const lineaSchema = z.object({
  descripcion: z.string(),
  cantidad: z.number(),
  precio: z.coerce.number(),
  precio_lista: z.coerce.number().nullable(),
})

export const ventaLocalSchema = z.object({
  id: z.string(),
  numero: z.number(),
  fecha: z.string(),
  local_id: z.string().nullable(),
  local: z.string().nullable(),
  vendedor: z.string(),
  cliente: z.string(),
  documento: z.string().nullable(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'tarjeta']).nullable(),
  total: z.coerce.number(),
  lineas: z.array(lineaSchema),
})
export const reporteLocalesSchema = z.array(ventaLocalSchema)

export type VentaLocal = z.infer<typeof ventaLocalSchema>

export interface Totales {
  ventas: number
  pares: number
  total: number
  efectivo: number
  transferencia: number
  tarjeta: number
  /** Cuánto se vendió por debajo del precio de lista (descuentos de vendedor y admin). */
  rebaja: number
}

export interface DiaVentas extends Totales {
  /** AAAA-MM-DD en la hora local del navegador. */
  dia: string
  detalle: VentaLocal[]
}

export interface LocalVentas extends Totales {
  clave: string
  nombre: string
  dias: DiaVentas[]
}

const redondear = (n: number) => Math.round(n * 100) / 100
const vacio = (): Totales => ({ ventas: 0, pares: 0, total: 0, efectivo: 0, transferencia: 0, tarjeta: 0, rebaja: 0 })

function sumar(t: Totales, v: VentaLocal) {
  t.ventas += 1
  t.total = redondear(t.total + v.total)
  if (v.metodo_pago) t[v.metodo_pago] = redondear(t[v.metodo_pago] + v.total)
  for (const l of v.lineas) {
    t.pares += l.cantidad
    if (l.precio_lista !== null && l.precio_lista > l.precio) t.rebaja = redondear(t.rebaja + (l.precio_lista - l.precio) * l.cantidad)
  }
}

/** Agrupa las ventas por local y, dentro de cada local, por día (los más recientes primero). */
export function agruparPorLocal(ventas: VentaLocal[]): { locales: LocalVentas[]; general: Totales } {
  const general = vacio()
  const m = new Map<string, LocalVentas>()
  for (const v of ventas) {
    sumar(general, v)
    const clave = v.local_id ?? 'sin-local'
    const loc = m.get(clave) ?? { clave, nombre: v.local ? `Local ${v.local}` : 'Sin local asignado', dias: [], ...vacio() }
    sumar(loc, v)
    const dia = aFechaInput(new Date(v.fecha))
    let d = loc.dias.find((x) => x.dia === dia)
    if (!d) {
      d = { dia, detalle: [], ...vacio() }
      loc.dias.push(d)
    }
    sumar(d, v)
    d.detalle.push(v)
    m.set(clave, loc)
  }
  const locales = [...m.values()]
  for (const l of locales) {
    l.dias.sort((a, b) => b.dia.localeCompare(a.dia))
    for (const d of l.dias) d.detalle.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }
  // Los locales con nombre van por orden alfabético; las ventas sin local, al final.
  locales.sort((a, b) => (a.clave === 'sin-local' ? 1 : b.clave === 'sin-local' ? -1 : a.nombre.localeCompare(b.nombre, 'es')))
  return { locales, general }
}

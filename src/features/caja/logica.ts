import { CANALES, type Canal, type FilaVentas } from './schemas'

export const NOMBRE_CANAL: Record<Canal, { titulo: string; descripcion: string }> = {
  local: { titulo: 'Local', descripcion: 'Ventas del punto físico, por quien las registró.' },
  sector: { titulo: 'Mayoristas del sector', descripcion: 'Lo que vendió cada mayorista en sus cierres, a su precio de mayorista.' },
  web: { titulo: 'Tienda en línea', descripcion: 'Pedidos de la tienda confirmados o entregados.' },
  whatsapp: { titulo: 'Pedidos por WhatsApp', descripcion: 'Pedidos de las tiendas de los mayoristas, confirmados o entregados.' },
  mayoristas: { titulo: 'Pedidos de mayoristas', descripcion: 'Compras de mayoristas al administrador, confirmadas o entregadas.' },
}

export interface ResumenCanal {
  canal: Canal
  total: number
  pedidos: number
  efectivo: number
  transferencia: number
  tarjeta: number
  porCobrar: number
  filas: FilaVentas[]
}

/** Agrupa por canal. Siempre devuelve todos los canales, también los que no vendieron nada. */
export function resumirCanales(filas: FilaVentas[]): { canales: ResumenCanal[]; totalGeneral: number; pedidosGeneral: number } {
  const canales = CANALES.map((canal) => {
    const propias = filas.filter((f) => f.canal === canal)
    const suma = (k: 'total' | 'pedidos' | 'efectivo' | 'transferencia' | 'tarjeta' | 'por_cobrar') => propias.reduce((s, f) => s + f[k], 0)
    return {
      canal,
      total: suma('total'),
      pedidos: suma('pedidos'),
      efectivo: suma('efectivo'),
      transferencia: suma('transferencia'),
      tarjeta: suma('tarjeta'),
      porCobrar: suma('por_cobrar'),
      filas: propias,
    }
  })
  return {
    canales,
    totalGeneral: canales.reduce((s, c) => s + c.total, 0),
    pedidosGeneral: canales.reduce((s, c) => s + c.pedidos, 0),
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const aFechaInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Periodo [desde, hasta) en hora local a partir de dos fechas "AAAA-MM-DD" (la segunda inclusive). */
export function periodo(desde: string, hasta: string): { desde: Date; hasta: Date } | null {
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  if (![y1, m1, d1, y2, m2, d2].every(Number.isFinite)) return null
  const ini = new Date(y1, m1 - 1, d1)
  const fin = new Date(y2, m2 - 1, d2 + 1)
  return fin > ini ? { desde: ini, hasta: fin } : null
}

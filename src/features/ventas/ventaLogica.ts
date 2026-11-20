export interface LineaVenta {
  varianteId: string
  nombre: string
  color: string
  talla: string
  precio: number
  cantidad: number
  stock: number
}

/** Suma una unidad de la variante, sin pasar del stock disponible. */
export function agregarLinea(lineas: LineaVenta[], nueva: Omit<LineaVenta, 'cantidad'>): LineaVenta[] {
  const i = lineas.findIndex((l) => l.varianteId === nueva.varianteId)
  if (i === -1) return nueva.stock > 0 ? [...lineas, { ...nueva, cantidad: 1 }] : lineas
  return lineas.map((l, j) => (j === i ? { ...l, cantidad: Math.min(l.stock, l.cantidad + 1) } : l))
}

export function totalVenta(lineas: LineaVenta[]): number {
  return Math.round(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0) * 100) / 100
}

export function unidadesVenta(lineas: LineaVenta[]): number {
  return lineas.reduce((s, l) => s + l.cantidad, 0)
}

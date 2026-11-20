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

/** Total de una venta por cerrar con los precios que el admin escribió (los vacíos o inválidos no suman). */
export function totalCierre(lineas: { id: string; cantidad: number; precio: number }[], precios: Record<string, number>): number {
  return Math.round(lineas.reduce((s, l) => s + (precios[l.id] ?? l.precio) * l.cantidad, 0) * 100) / 100
}

/** Precios que el admin cambió respecto al de lista. Error si alguno no es un número válido. */
export function preciosDeCierre(
  lineas: { id: string; precio: number }[],
  precios: Record<string, number>,
): { ok: true; cambios: { detalle_id: string; precio: number }[] } | { ok: false; error: string } {
  const cambios: { detalle_id: string; precio: number }[] = []
  for (const l of lineas) {
    const p = precios[l.id]
    if (p === undefined) continue
    if (!Number.isFinite(p) || p < 0) return { ok: false, error: 'Hay un precio no válido.' }
    if (Math.round(p * 100) !== Math.round(l.precio * 100)) cambios.push({ detalle_id: l.id, precio: Math.round(p * 100) / 100 })
  }
  return { ok: true, cambios }
}

export interface Especial {
  precio: number | null
  descuentoPct: number | null
}

const redondear = (n: number) => Math.round(n * 100) / 100

/**
 * Costo mayorista que el servidor aplicará a este mayorista (misma regla que `obtener_precio_mayorista`):
 * precio fijo especial > descuento % sobre el precio base > precio base.
 */
export function costoMayorista(base: number | null, especial?: Especial): number | null {
  if (especial?.precio != null) return especial.precio
  if (base !== null && especial?.descuentoPct != null) return redondear(base * (1 - especial.descuentoPct / 100))
  return base
}

export function margen(venta: number, costo: number): { monto: number; pct: number } {
  const monto = redondear(venta - costo)
  return { monto, pct: costo > 0 ? redondear((monto / costo) * 100) : 0 }
}

/** Precio de venta que deja `pct`% de margen sobre el costo. */
export function precioConMargen(costo: number, pct: number): number {
  return redondear(costo * (1 + pct / 100))
}

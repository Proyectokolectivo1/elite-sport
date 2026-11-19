import type { ProductoValues } from './schemas'

/** Rango de tallas sugerido al crear un modelo, según su grupo. El admin lo ajusta por modelo. */
export const RANGO_POR_GRUPO: Record<ProductoValues['grupo'], { desde: number; hasta: number }> = {
  nino: { desde: 22, hasta: 33 },
  dama: { desde: 34, hasta: 40 },
  caballero: { desde: 38, hasta: 45 },
}

/** Tallas enteras de `desde` a `hasta`, ambas incluidas. Vacío si el rango no es válido. */
export function generarRango(desde: number, hasta: number): string[] {
  if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde > hasta) return []
  return Array.from({ length: hasta - desde + 1 }, (_, i) => String(desde + i))
}

/** Filas para guardar: cada talla del rango con sus pares por caja (vacío = 0). */
export function filasModelo(desde: number, hasta: number, pares: Record<string, string>): { etiqueta: string; pares: number }[] {
  return generarRango(desde, hasta).map((etiqueta) => ({ etiqueta, pares: Math.max(0, Math.trunc(Number(pares[etiqueta]) || 0)) }))
}

export const paresDeCaja = (filas: { pares: number }[]) => filas.reduce((s, f) => s + f.pares, 0)

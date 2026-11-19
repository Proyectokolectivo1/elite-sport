export interface LineaDevolvible {
  id: string
  descripcion: string
  cantidad: number
  devuelta: number
  precio: number
}

/** Pares de la línea que todavía se pueden devolver. */
export const porDevolver = (l: LineaDevolvible) => Math.max(0, l.cantidad - l.devuelta)

/** Pares elegidos y monto a devolver al cliente. */
export function resumenDevolucion(lineas: LineaDevolvible[], elegidos: Record<string, number>): { pares: number; total: number } {
  let pares = 0
  let total = 0
  for (const l of lineas) {
    const n = Math.max(0, Math.min(porDevolver(l), Math.trunc(elegidos[l.id] ?? 0) || 0))
    pares += n
    total += n * l.precio
  }
  return { pares, total }
}

/** Reglas del cierre de una entrega de bodega (mismas que valida cerrar_pedido_bodega en la base). */

export interface LineaEntrega {
  id: string
  entregada: number
  vendida: number
  devuelta: number
}

export interface ValorCierre {
  vendidos: number
  devueltos: number
}

/** Pares que el solicitante aún tiene en su poder. */
export function pendiente(l: LineaEntrega): number {
  return Math.max(0, l.entregada - l.vendida - l.devuelta)
}

/** Propuesta inicial: lo ya registrado como vendido, y el resto regresa. */
export function valoresIniciales(lineas: LineaEntrega[]): Record<string, ValorCierre> {
  return Object.fromEntries(lineas.map((l) => [l.id, { vendidos: l.vendida, devueltos: pendiente(l) }]))
}

/** Al cambiar los vendidos, los devueltos se completan con el resto (sin bajar de 0). */
export function conVendidos(l: LineaEntrega, vendidos: number): ValorCierre {
  const v = Math.max(l.vendida, Math.min(l.entregada - l.devuelta, Math.trunc(vendidos) || 0))
  return { vendidos: v, devueltos: l.entregada - l.devuelta - v }
}

/** Pares que todavía se pueden marcar como devueltos (lo registrado como vendido ya no regresa). */
export function maxDevueltos(l: LineaEntrega): number {
  return Math.max(0, l.entregada - l.devuelta - l.vendida)
}

/** Al cambiar los que regresan, los vendidos se completan con el resto: la línea siempre cuadra. */
export function conDevueltos(l: LineaEntrega, devueltos: number): ValorCierre {
  const d = Math.max(0, Math.min(maxDevueltos(l), Math.trunc(devueltos) || 0))
  return { vendidos: l.entregada - l.devuelta - d, devueltos: d }
}

export interface ResultadoCuadre {
  ok: boolean
  mensaje: string | null
}

export function cuadreLinea(l: LineaEntrega, v: ValorCierre | undefined): ResultadoCuadre {
  if (!v) return { ok: false, mensaje: 'Faltan cantidades' }
  if (!Number.isInteger(v.vendidos) || !Number.isInteger(v.devueltos) || v.vendidos < 0 || v.devueltos < 0) {
    return { ok: false, mensaje: 'Usa números enteros' }
  }
  if (v.vendidos < l.vendida) return { ok: false, mensaje: `Ya hay ${l.vendida} vendidos registrados` }
  const suma = v.vendidos + v.devueltos + l.devuelta
  if (suma !== l.entregada) {
    const dif = l.entregada - suma
    return { ok: false, mensaje: dif > 0 ? `Faltan ${dif} por anotar` : `Sobran ${-dif}` }
  }
  return { ok: true, mensaje: null }
}

export function cuadreEntrega(lineas: LineaEntrega[], valores: Record<string, ValorCierre>): boolean {
  return lineas.length > 0 && lineas.every((l) => cuadreLinea(l, valores[l.id]).ok)
}

/** Pares vendidos al cierre que el vendedor no registró (quedan como venta aparte). */
export function vendidosSinRegistrar(lineas: LineaEntrega[], valores: Record<string, ValorCierre>): number {
  return lineas.reduce((s, l) => s + Math.max(0, (valores[l.id]?.vendidos ?? l.vendida) - l.vendida), 0)
}

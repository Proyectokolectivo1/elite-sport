import type { Existencia } from './api/inventario'

/** Por debajo de esto una talla se marca como "pocas" y un producto como "stock bajo". */
export const UMBRAL_TALLA = 3
export const UMBRAL_PRODUCTO = 6

export type EstadoStock = 'disponible' | 'bajo' | 'agotado'

export interface ColorStock {
  color: string
  total: number
  tallas: Existencia[]
}

export interface ProductoStock {
  productoId: string
  producto: string
  total: number
  /** Tallas con stock / tallas totales. */
  tallasConStock: number
  tallasTotal: number
  estado: EstadoStock
  colores: ColorStock[]
}

export function estadoDe(total: number): EstadoStock {
  return total === 0 ? 'agotado' : total <= UMBRAL_PRODUCTO ? 'bajo' : 'disponible'
}

/** Agrupa las variantes (producto · color · talla) en productos, con sus colores y tallas en orden. */
export function agruparPorProducto(existencias: Existencia[]): ProductoStock[] {
  const m = new Map<string, ProductoStock>()
  for (const e of existencias) {
    const p = m.get(e.productoId) ?? { productoId: e.productoId, producto: e.producto, total: 0, tallasConStock: 0, tallasTotal: 0, estado: 'agotado' as EstadoStock, colores: [] }
    let c = p.colores.find((x) => x.color === e.color)
    if (!c) {
      c = { color: e.color, total: 0, tallas: [] }
      p.colores.push(c)
    }
    c.tallas.push(e)
    c.total += e.stock
    p.total += e.stock
    p.tallasTotal += 1
    if (e.stock > 0) p.tallasConStock += 1
    m.set(e.productoId, p)
  }
  const lista = [...m.values()]
  for (const p of lista) {
    p.estado = estadoDe(p.total)
    p.colores.sort((a, b) => a.color.localeCompare(b.color, 'es'))
    for (const c of p.colores) c.tallas.sort((a, b) => a.tallaOrden - b.tallaOrden)
  }
  return lista.sort((a, b) => a.producto.localeCompare(b.producto, 'es'))
}

export interface ResumenStock {
  productos: number
  pares: number
  bajos: number
  agotados: number
}

export function resumir(productos: ProductoStock[]): ResumenStock {
  return {
    productos: productos.length,
    pares: productos.reduce((s, p) => s + p.total, 0),
    bajos: productos.filter((p) => p.estado === 'bajo').length,
    agotados: productos.filter((p) => p.estado === 'agotado').length,
  }
}

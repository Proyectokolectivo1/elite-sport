import { describe, expect, it } from 'vitest'
import type { Existencia } from './api/inventario'
import { agruparPorProducto, estadoDe, resumir } from './agrupar'

const e = (id: string, productoId: string, producto: string, color: string, talla: string, tallaOrden: number, stock: number): Existencia => ({
  id, productoId, producto, color, talla, tallaOrden, sku: id, stock,
})

describe('agruparPorProducto', () => {
  const datos = [
    e('1', 'p2', 'Runner', 'Negro', '41', 41, 4),
    e('2', 'p2', 'Runner', 'Negro', '39', 39, 0),
    e('3', 'p2', 'Runner', 'Blanco', '40', 40, 8),
    e('4', 'p1', 'Aura', 'Rojo', '38', 38, 0),
  ]

  it('junta por producto, ordena por nombre y suma los pares', () => {
    const r = agruparPorProducto(datos)
    expect(r.map((p) => p.producto)).toEqual(['Aura', 'Runner'])
    expect(r[1].total).toBe(12)
    expect(r[1].tallasConStock).toBe(2)
    expect(r[1].tallasTotal).toBe(3)
  })

  it('ordena colores por nombre y tallas por su orden', () => {
    const runner = agruparPorProducto(datos)[1]
    expect(runner.colores.map((c) => c.color)).toEqual(['Blanco', 'Negro'])
    expect(runner.colores[1].tallas.map((t) => t.talla)).toEqual(['39', '41'])
    expect(runner.colores[1].total).toBe(4)
  })

  it('marca el estado según el total del producto', () => {
    expect(estadoDe(0)).toBe('agotado')
    expect(estadoDe(6)).toBe('bajo')
    expect(estadoDe(7)).toBe('disponible')
    expect(agruparPorProducto(datos).map((p) => p.estado)).toEqual(['agotado', 'disponible'])
  })

  it('resume productos, pares, bajos y agotados', () => {
    expect(resumir(agruparPorProducto(datos))).toEqual({ productos: 2, pares: 12, bajos: 0, agotados: 1 })
  })
})

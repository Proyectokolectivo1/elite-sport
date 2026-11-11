import { describe, expect, it } from 'vitest'
import { agregarLinea, totalVenta, unidadesVenta, type LineaVenta } from './ventaLogica'

const base = { varianteId: 'v1', nombre: 'Runner', color: 'Negro', talla: '40', precio: 89.9, stock: 3 }

describe('venta en tienda', () => {
  it('agrega una línea y suma unidades del mismo par sin pasar el stock', () => {
    let l: LineaVenta[] = []
    for (let i = 0; i < 5; i++) l = agregarLinea(l, base)
    expect(l).toHaveLength(1)
    expect(l[0].cantidad).toBe(3)
  })
  it('no agrega variantes sin stock', () => {
    expect(agregarLinea([], { ...base, stock: 0 })).toEqual([])
  })
  it('calcula total y unidades con precios editados', () => {
    let l = agregarLinea([], base)
    l = agregarLinea(l, base)
    l = [...l, { varianteId: 'v2', nombre: 'Aura', color: 'Blanco', talla: '37', precio: 50, cantidad: 1, stock: 2 }]
    expect(unidadesVenta(l)).toBe(3)
    expect(totalVenta(l)).toBe(229.8)
  })
})

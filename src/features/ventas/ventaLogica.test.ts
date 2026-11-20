import { describe, expect, it } from 'vitest'
import { agregarLinea, preciosDeCierre, totalCierre, totalVenta, unidadesVenta, type LineaVenta } from './ventaLogica'

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

describe('cierre de la venta del local', () => {
  const lineas = [{ id: 'a', cantidad: 2, precio: 50 }, { id: 'b', cantidad: 1, precio: 30 }]

  it('suma con los precios que fija el admin y conserva los demás', () => {
    expect(totalCierre(lineas, {})).toBe(130)
    expect(totalCierre(lineas, { a: 45.5 })).toBe(121)
  })

  it('envía solo los precios cambiados y rechaza los inválidos', () => {
    expect(preciosDeCierre(lineas, { a: 50, b: 25 })).toEqual({ ok: true, cambios: [{ detalle_id: 'b', precio: 25 }] })
    expect(preciosDeCierre(lineas, { a: Number.NaN })).toEqual({ ok: false, error: 'Hay un precio no válido.' })
    expect(preciosDeCierre(lineas, { b: -1 }).ok).toBe(false)
  })
})

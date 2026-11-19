import { describe, expect, it } from 'vitest'
import { conDevueltos, conVendidos, cuadreEntrega, cuadreLinea, pendiente, valoresIniciales, vendidosSinRegistrar, aLiberar, repartibles, type LineaEntrega } from './logica'

const linea: LineaEntrega = { id: 'd1', entregada: 4, vendida: 2, devuelta: 1 }

describe('cierre de una entrega de bodega', () => {
  it('calcula los pares que siguen en poder del solicitante', () => {
    expect(pendiente(linea)).toBe(1)
    expect(pendiente({ id: 'x', entregada: 3, vendida: 3, devuelta: 0 })).toBe(0)
  })

  it('propone lo registrado como vendido y el resto como devuelto', () => {
    expect(valoresIniciales([linea])).toEqual({ d1: { vendidos: 2, devueltos: 1 } })
  })

  it('al cambiar vendidos completa los devueltos sin pasar lo entregado', () => {
    expect(conVendidos(linea, 3)).toEqual({ vendidos: 3, devueltos: 0 })
    expect(conVendidos(linea, 0)).toEqual({ vendidos: 0, devueltos: 3 })
    expect(conVendidos(linea, 9)).toEqual({ vendidos: 3, devueltos: 0 })
  })

  it('no cuadra si faltan o sobran pares', () => {
    expect(cuadreLinea(linea, { vendidos: 2, devueltos: 0 })).toEqual({ ok: false, mensaje: 'Faltan 1 por anotar' })
    expect(cuadreLinea(linea, { vendidos: 2, devueltos: 2 })).toEqual({ ok: false, mensaje: 'Sobran 1' })
    expect(cuadreLinea(linea, { vendidos: 2.5, devueltos: 0.5 }).ok).toBe(false)
  })

  it('cuadra cuando vendidos + devueltos + devueltos antes = entregados', () => {
    expect(cuadreLinea(linea, { vendidos: 3, devueltos: 0 }).ok).toBe(true)
    expect(cuadreEntrega([linea], { d1: { vendidos: 2, devueltos: 1 } })).toBe(true)
    expect(cuadreEntrega([], {})).toBe(false)
  })

  it('cuenta los vendidos que el vendedor no registró', () => {
    expect(vendidosSinRegistrar([linea], { d1: { vendidos: 3, devueltos: 0 } })).toBe(1)
    expect(vendidosSinRegistrar([linea], { d1: { vendidos: 2, devueltos: 1 } })).toBe(0)
  })

  it('al cambiar los que regresan completa los vendidos y la línea cuadra', () => {
    const l: LineaEntrega = { id: 'd2', entregada: 6, vendida: 1, devuelta: 0 }
    expect(repartibles(l)).toBe(6)
    expect(conDevueltos(l, 2)).toEqual({ vendidos: 4, devueltos: 2 })
    expect(conDevueltos(l, 9)).toEqual({ vendidos: 0, devueltos: 6 })
    expect(conDevueltos(l, -1)).toEqual({ vendidos: 6, devueltos: 0 })
    expect(cuadreLinea(l, conDevueltos(l, 3)).ok).toBe(true)
  })

  it('un par registrado como vendido puede regresar: se libera esa venta', () => {
    const l: LineaEntrega = { id: 'd3', entregada: 1, vendida: 1, devuelta: 0 }
    expect(conDevueltos(l, 1)).toEqual({ vendidos: 0, devueltos: 1 })
    expect(cuadreLinea(l, { vendidos: 0, devueltos: 1 }).ok).toBe(true)
    expect(aLiberar(l, 0)).toBe(1)
    expect(aLiberar(l, 1)).toBe(0)
    expect(aLiberar(linea, 1)).toBe(1)
  })
})

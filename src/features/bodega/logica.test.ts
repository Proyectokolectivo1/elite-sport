import { describe, expect, it } from 'vitest'
import { conVendidos, cuadreEntrega, cuadreLinea, pendiente, valoresIniciales, vendidosSinRegistrar, type LineaEntrega } from './logica'

const linea: LineaEntrega = { id: 'd1', entregada: 4, vendida: 2, devuelta: 1 }

describe('cierre de una entrega de bodega', () => {
  it('calcula los pares que siguen en poder del solicitante', () => {
    expect(pendiente(linea)).toBe(1)
    expect(pendiente({ id: 'x', entregada: 3, vendida: 3, devuelta: 0 })).toBe(0)
  })

  it('propone lo registrado como vendido y el resto como devuelto', () => {
    expect(valoresIniciales([linea])).toEqual({ d1: { vendidos: 2, devueltos: 1 } })
  })

  it('al cambiar vendidos completa los devueltos sin bajar de lo registrado ni pasar lo entregado', () => {
    expect(conVendidos(linea, 3)).toEqual({ vendidos: 3, devueltos: 0 })
    expect(conVendidos(linea, 0)).toEqual({ vendidos: 2, devueltos: 1 })
    expect(conVendidos(linea, 9)).toEqual({ vendidos: 3, devueltos: 0 })
  })

  it('no cuadra si faltan o sobran pares', () => {
    expect(cuadreLinea(linea, { vendidos: 2, devueltos: 0 })).toEqual({ ok: false, mensaje: 'Faltan 1 por anotar' })
    expect(cuadreLinea(linea, { vendidos: 2, devueltos: 2 })).toEqual({ ok: false, mensaje: 'Sobran 1' })
    expect(cuadreLinea(linea, { vendidos: 1, devueltos: 2 }).ok).toBe(false)
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
})

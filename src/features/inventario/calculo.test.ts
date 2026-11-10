import { describe, expect, it } from 'vitest'
import { calcularLineas, paresPorCaja, totalUnidades } from './calculo'

const curva = [
  { tallaId: '35', pares: 3 },
  { tallaId: '37', pares: 3 },
]

describe('calcularLineas', () => {
  it('2 cajas con 3 pares de la 35 y 3 de la 37 dan 6 y 6', () => {
    const r = calcularLineas(curva, 2)
    expect(r.map((l) => l.total)).toEqual([6, 6])
    expect(totalUnidades(r)).toBe(12)
  })

  it('respeta el total editado a mano', () => {
    const r = calcularLineas([{ tallaId: '35', pares: 3, totalManual: 5 }, curva[1]], 2)
    expect(r.map((l) => l.total)).toEqual([5, 6])
  })

  it('sin cajas válidas el total es 0', () => {
    expect(totalUnidades(calcularLineas(curva, 0))).toBe(0)
    expect(totalUnidades(calcularLineas(curva, Number.NaN))).toBe(0)
  })

  it('suma los pares de una caja', () => {
    expect(paresPorCaja(curva)).toBe(6)
  })
})

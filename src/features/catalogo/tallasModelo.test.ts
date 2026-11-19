import { describe, expect, it } from 'vitest'
import { tallasModeloSchema } from './schemas'
import { filasModelo, generarRango, paresDeCaja } from './tallasModelo'

describe('tallas por modelo', () => {
  it('genera el rango completo, de 25 a 45 o de 36 a 45', () => {
    expect(generarRango(25, 45)).toHaveLength(21)
    expect(generarRango(36, 45)).toEqual(['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'])
    expect(generarRango(45, 36)).toEqual([])
  })

  it('arma las filas con el surtido de la caja (vacío = 0)', () => {
    const filas = filasModelo(38, 41, { '38': '1', '39': '2', '40': '', '41': '3' })
    expect(filas).toEqual([
      { etiqueta: '38', pares: 1 },
      { etiqueta: '39', pares: 2 },
      { etiqueta: '40', pares: 0 },
      { etiqueta: '41', pares: 3 },
    ])
    expect(paresDeCaja(filas)).toBe(6)
  })

  it('valida el rango y los pares', () => {
    expect(tallasModeloSchema.safeParse({ desde: 25, hasta: 45, pares: { '30': '2' } }).success).toBe(true)
    expect(tallasModeloSchema.safeParse({ desde: 45, hasta: 25, pares: {} }).success).toBe(false)
    expect(tallasModeloSchema.safeParse({ desde: 38, hasta: 40, pares: { '39': '-1' } }).success).toBe(false)
    expect(tallasModeloSchema.safeParse({ desde: 38, hasta: 40, pares: { '39': '101' } }).success).toBe(false)
  })
})

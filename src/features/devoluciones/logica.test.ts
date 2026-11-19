import { describe, expect, it } from 'vitest'
import { porDevolver, resumenDevolucion, type LineaDevolvible } from './logica'

const l1: LineaDevolvible = { id: 'a', descripcion: 'Runner · Negro · talla 40', cantidad: 3, devuelta: 1, precio: 50 }
const l2: LineaDevolvible = { id: 'b', descripcion: 'Foce · Negro · talla 41', cantidad: 1, devuelta: 1, precio: 45 }

describe('devoluciones', () => {
  it('calcula los pares que aún se pueden devolver', () => {
    expect(porDevolver(l1)).toBe(2)
    expect(porDevolver(l2)).toBe(0)
  })

  it('suma pares y monto sin pasar de lo que queda por devolver', () => {
    expect(resumenDevolucion([l1, l2], { a: 2 })).toEqual({ pares: 2, total: 100 })
    expect(resumenDevolucion([l1, l2], { a: 9, b: 1 })).toEqual({ pares: 2, total: 100 })
    expect(resumenDevolucion([l1, l2], { a: -3 })).toEqual({ pares: 0, total: 0 })
    expect(resumenDevolucion([l1, l2], {})).toEqual({ pares: 0, total: 0 })
  })
})

import { describe, expect, it } from 'vitest'
import { costoMayorista, margen, precioConMargen } from './precio'

describe('costoMayorista', () => {
  it('usa el precio base si no hay especial', () => {
    expect(costoMayorista(62.93)).toBe(62.93)
  })
  it('el precio fijo especial gana', () => {
    expect(costoMayorista(62.93, { precio: 55, descuentoPct: null })).toBe(55)
  })
  it('aplica el descuento % sobre la base', () => {
    expect(costoMayorista(100, { precio: null, descuentoPct: 15 })).toBe(85)
  })
  it('sin base ni precio fijo no hay costo', () => {
    expect(costoMayorista(null, { precio: null, descuentoPct: 10 })).toBeNull()
  })
})

describe('margen', () => {
  it('calcula monto y porcentaje', () => {
    expect(margen(89.9, 62.93)).toEqual({ monto: 26.97, pct: 42.86 })
  })
  it('costo 0 no divide por cero', () => {
    expect(margen(10, 0).pct).toBe(0)
  })
  it('precio con margen', () => {
    expect(precioConMargen(50, 40)).toBe(70)
  })
})

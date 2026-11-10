import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  it('formatea USD por defecto', () => {
    expect(formatMoney(89.9, { moneda_codigo: 'USD', moneda_simbolo: '$', moneda_decimales: 2, locale: 'en-US' })).toBe(
      '$89.90',
    )
  })

  it('respeta otra moneda y sus decimales', () => {
    const out = formatMoney(1500, { moneda_codigo: 'COP', moneda_simbolo: '$', moneda_decimales: 0, locale: 'es-CO' })
    expect(out).toMatch(/1\.500/)
    expect(out).not.toMatch(/,00/)
  })

  it('cae al símbolo si el código de moneda es inválido', () => {
    expect(formatMoney(5, { moneda_codigo: 'XX', moneda_simbolo: 'S/', moneda_decimales: 2, locale: 'es-PE' })).toBe(
      'S/5.00',
    )
  })
})

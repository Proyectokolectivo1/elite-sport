import { describe, expect, it } from 'vitest'
import { buildBrandTokens, contrastRatio, ensureContrast, readableOn } from './color'

describe('color', () => {
  it('calcula el contraste máximo entre negro y blanco', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('elige texto legible sobre fondos claros y oscuros', () => {
    expect(readableOn('#c8ff2e')).toBe('#0b0b0c')
    expect(readableOn('#0b0b0c')).toBe('#f4f2ed')
  })

  it('corrige un color que no cumple el contraste mínimo', () => {
    const fixed = ensureContrast('#111111', '#0b0b0c', 3)
    expect(contrastRatio(fixed, '#0b0b0c')).toBeGreaterThanOrEqual(3)
  })

  it('deja intacto un color que ya cumple', () => {
    expect(ensureContrast('#c8ff2e', '#0b0b0c', 4.5)).toBe('#c8ff2e')
  })

  it('genera tokens válidos aunque la entrada sea inválida', () => {
    const t = buildBrandTokens({ primary: 'rojo', accent: '#zzz' })
    expect(t.primary).toBe('#0b0b0c')
    expect(t.adjusted).toBe(true)
  })

  it('ajusta un acento ilegible sobre el primario', () => {
    const t = buildBrandTokens({ primary: '#0b0b0c', accent: '#1a1a1a' })
    expect(contrastRatio(t.accent, t.primary)).toBeGreaterThanOrEqual(3)
    expect(t.adjusted).toBe(true)
  })
})

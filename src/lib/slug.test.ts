import { describe, expect, it } from 'vitest'
import { slugify } from './slug'

describe('slugify', () => {
  it('quita tildes y símbolos', () => {
    expect(slugify('Clásico Court  Niño!')).toBe('clasico-court-nino')
  })
  it('no deja guiones en los bordes', () => {
    expect(slugify('  --Fútbol--  ')).toBe('futbol')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { guardarSonido, sonidoActivo } from './sonido'

describe('sonido de avisos', () => {
  beforeEach(() => localStorage.clear())

  it('queda activo por defecto y recuerda la preferencia', () => {
    expect(sonidoActivo()).toBe(true)
    guardarSonido(false)
    expect(sonidoActivo()).toBe(false)
    guardarSonido(true)
    expect(sonidoActivo()).toBe(true)
  })
})

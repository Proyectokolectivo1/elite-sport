import { describe, expect, it } from 'vitest'
import { progresoScroll, suavizar, tiempoObjetivo } from './scroll'

describe('fondo en movimiento', () => {
  it('calcula el avance del scroll entre 0 y 1', () => {
    expect(progresoScroll(0, 3000, 800)).toBe(0)
    expect(progresoScroll(1100, 3000, 800)).toBe(0.5)
    expect(progresoScroll(5000, 3000, 800)).toBe(1)
  })
  it('una página que cabe en pantalla no avanza', () => {
    expect(progresoScroll(0, 700, 800)).toBe(0)
  })
  it('mapea el avance al segundo del video sin llegar al final exacto', () => {
    expect(tiempoObjetivo(0, 10)).toBe(0)
    expect(tiempoObjetivo(1, 10)).toBeCloseTo(9.95)
    expect(tiempoObjetivo(0.5, 10)).toBeCloseTo(4.975)
  })
  it('duración inválida devuelve 0', () => {
    expect(tiempoObjetivo(0.5, Number.NaN)).toBe(0)
    expect(tiempoObjetivo(0.5, 0)).toBe(0)
  })
  it('suaviza hacia el objetivo y converge', () => {
    let t = 0
    for (let i = 0; i < 80; i++) t = suavizar(t, 5)
    expect(t).toBe(5)
    expect(suavizar(0, 5)).toBeGreaterThan(0)
    expect(suavizar(0, 5)).toBeLessThan(5)
  })
})

import { describe, expect, it } from 'vitest'
import { opcionesExhibicion, paresEnExhibicion, soloExhibicion, textoPieza, validarFilasExhibicion } from './logica'
import type { PiezaVendedor } from './schemas'

const p = (id: string, pieza: PiezaVendedor['pieza'], local: string, propia = false): PiezaVendedor => ({ id, variante_id: 'v', pieza, local_id: local, local, propia })

describe('exhibición', () => {
  const piezas = [{ pieza: 'par' as const }, { pieza: 'derecho' as const }, { pieza: 'izquierdo' as const }]

  it('cuenta el par completo y el par armado', () => {
    expect(paresEnExhibicion(piezas)).toBe(2)
    expect(paresEnExhibicion([{ pieza: 'derecho' }])).toBe(0)
  })

  it('avisa cuando solo quedan pares de exhibición', () => {
    expect(soloExhibicion(2, piezas)).toBe(true)
    expect(soloExhibicion(3, piezas)).toBe(false)
    expect(soloExhibicion(0, piezas)).toBe(false)
    expect(soloExhibicion(5, [])).toBe(false)
  })

  it('arma las opciones de venta y deja primero lo del propio local', () => {
    const o = opcionesExhibicion([p('a', 'par', 'KZ'), p('b', 'derecho', 'Élite', true), p('c', 'izquierdo', 'Mega Moda')])
    expect(o).toHaveLength(2)
    expect(o[0]).toMatchObject({ ids: ['a'], texto: 'Par completo en Local KZ' })
    expect(o[1]).toMatchObject({ ids: ['b', 'c'], texto: 'Derecho en tu local + izquierdo en Local Mega Moda' })
  })

  it('no ofrece un pie suelto sin su pareja', () => {
    expect(opcionesExhibicion([p('b', 'derecho', 'Élite')])).toEqual([])
  })

  it('describe la pieza para bodega', () => {
    expect(textoPieza('derecho', 'KZ')).toBe('derecho del Local KZ')
  })

  it('valida las piezas del formulario de producto', () => {
    const f = (pieza: 'par' | 'derecho' | 'izquierdo', color = 'Negro', talla = '40', localId = 'a') => ({ color, talla, pieza, localId })
    expect(validarFilasExhibicion([f('par'), f('derecho'), f('izquierdo')])).toBeNull()
    expect(validarFilasExhibicion([f('derecho')])).toMatch(/pie izquierdo/)
    expect(validarFilasExhibicion([f('derecho', 'Negro', '40'), f('izquierdo', 'Negro', '41')])).toMatch(/pie/)
    expect(validarFilasExhibicion([f('par', '')])).toMatch(/necesita/)
    expect(validarFilasExhibicion([f('par', 'Negro', '40', '')])).toMatch(/necesita/)
  })
})

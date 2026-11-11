import { describe, expect, it } from 'vitest'
import { FILTROS_VACIOS, contarFiltros, filtrosAServidor, filtrosAUrl, filtrosDesdeUrl } from './filtros'

describe('filtros en la URL', () => {
  it('ida y vuelta', () => {
    const f = { ...FILTROS_VACIOS, grupo: 'dama' as const, talla: '37', min: 10, orden: 'precio-desc' as const }
    expect(filtrosDesdeUrl(filtrosAUrl(f))).toEqual(f)
  })
  it('ignora valores inválidos', () => {
    expect(filtrosDesdeUrl(new URLSearchParams('g=otro&min=abc&orden=x'))).toEqual(FILTROS_VACIOS)
  })
  it('cuenta solo los filtros activos', () => {
    expect(contarFiltros(FILTROS_VACIOS)).toBe(0)
    expect(contarFiltros({ ...FILTROS_VACIOS, grupo: 'dama', talla: '38', max: 100 })).toBe(3)
  })
})

describe('filtros hacia el servidor', () => {
  it('traduce la URL a la búsqueda por lotes', () => {
    const f = { ...FILTROS_VACIOS, q: 'run', marca: 'm1', min: 20, orden: 'precio-asc' as const }
    expect(filtrosAServidor(f)).toMatchObject({ q: 'run', marca: 'm1', min: 20, orden: 'precio-asc' })
  })
})

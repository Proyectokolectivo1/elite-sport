import { describe, expect, it } from 'vitest'
import type { ProductoPublico } from './api/tienda'
import { FILTROS_VACIOS, filtrarProductos, filtrosAUrl, filtrosDesdeUrl } from './filtros'

const base = { descripcion: null, destacado: false, marca: null, categoria: null, estilo: null, imagenes: [] }
const prods: ProductoPublico[] = [
  { ...base, id: '1', slug: 'a', nombre: 'Runner', grupo: 'caballero', pvp: 90, creadoEn: '2026-01-02', variantes: [{ id: 'v1', color: 'Negro', tallaId: 't40', talla: '40', orden: 40, stock: 2 }] },
  { ...base, id: '2', slug: 'b', nombre: 'Aura', grupo: 'dama', pvp: 70, creadoEn: '2026-01-03', variantes: [{ id: 'v2', color: 'Blanco', tallaId: 't37', talla: '37', orden: 37, stock: 0 }] },
]
const pvp = (p: ProductoPublico) => p.pvp

describe('filtrarProductos', () => {
  it('filtra por talla solo si hay stock', () => {
    expect(filtrarProductos(prods, { ...FILTROS_VACIOS, talla: '37' }, pvp)).toHaveLength(0)
    expect(filtrarProductos(prods, { ...FILTROS_VACIOS, talla: '40' }, pvp).map((p) => p.id)).toEqual(['1'])
  })
  it('filtra por rango de precio de la tienda activa', () => {
    expect(filtrarProductos(prods, { ...FILTROS_VACIOS, max: 80 }, pvp).map((p) => p.id)).toEqual(['2'])
    expect(filtrarProductos(prods, { ...FILTROS_VACIOS, max: 80 }, () => 100)).toHaveLength(0)
  })
  it('ordena por precio y por novedad', () => {
    expect(filtrarProductos(prods, { ...FILTROS_VACIOS, orden: 'precio-asc' }, pvp).map((p) => p.id)).toEqual(['2', '1'])
    expect(filtrarProductos(prods, FILTROS_VACIOS, pvp).map((p) => p.id)).toEqual(['2', '1'])
  })
})

describe('filtros en la URL', () => {
  it('ida y vuelta', () => {
    const f = { ...FILTROS_VACIOS, grupo: 'dama' as const, talla: '37', min: 10, orden: 'precio-desc' as const }
    expect(filtrosDesdeUrl(filtrosAUrl(f))).toEqual(f)
  })
  it('ignora valores inválidos', () => {
    expect(filtrosDesdeUrl(new URLSearchParams('g=otro&min=abc&orden=x'))).toEqual(FILTROS_VACIOS)
  })
})

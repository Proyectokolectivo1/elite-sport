import { describe, expect, it } from 'vitest'
import { agruparPorLocal, type VentaLocal } from './reporteLocales'

const venta = (p: Partial<VentaLocal>): VentaLocal => ({
  id: crypto.randomUUID(),
  numero: 1,
  fecha: new Date(2026, 10, 19, 10).toISOString(),
  local_id: 'kz',
  local: 'KZ',
  vendedor: 'Ana',
  cliente: 'Consumidor final',
  documento: null,
  metodo_pago: 'efectivo',
  total: 100,
  lineas: [{ descripcion: 'Runner · Negro · talla 40', cantidad: 2, precio: 50, precio_lista: 60 }],
  ...p,
})

describe('ventas por local', () => {
  it('agrupa por local y por día, con totales, pares, forma de pago y rebaja', () => {
    const { locales, general } = agruparPorLocal([
      venta({ numero: 1 }),
      venta({ numero: 2, metodo_pago: 'tarjeta', total: 60, lineas: [{ descripcion: 'x', cantidad: 1, precio: 60, precio_lista: 60 }] }),
      venta({ numero: 3, fecha: new Date(2026, 10, 18, 18).toISOString() }),
      venta({ numero: 4, local_id: 'elite', local: 'Élite', total: 80, lineas: [{ descripcion: 'y', cantidad: 1, precio: 80, precio_lista: 70 }] }),
    ])
    expect(general).toMatchObject({ ventas: 4, total: 340, pares: 6, rebaja: 40 })
    expect(locales.map((l) => l.nombre)).toEqual(['Local Élite', 'Local KZ'])
    const kz = locales[1]
    expect(kz).toMatchObject({ ventas: 3, total: 260, efectivo: 200, tarjeta: 60, rebaja: 40 })
    expect(kz.dias.map((d) => d.dia)).toEqual(['2026-11-19', '2026-11-18'])
    expect(kz.dias[0]).toMatchObject({ ventas: 2, total: 160, pares: 3 })
    // Vender por encima de la lista no cuenta como rebaja.
    expect(locales[0].rebaja).toBe(0)
  })

  it('las ventas sin local van al final', () => {
    const { locales } = agruparPorLocal([venta({ local_id: null, local: null }), venta({ local_id: 'a', local: 'Mega Moda' })])
    expect(locales.map((l) => l.nombre)).toEqual(['Local Mega Moda', 'Sin local asignado'])
  })
})

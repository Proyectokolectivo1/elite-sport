import { describe, expect, it } from 'vitest'
import { aFechaInput, periodo, resumirCanales } from './logica'
import type { FilaVentas } from './schemas'

const fila = (p: Partial<FilaVentas>): FilaVentas => ({
  canal: 'local', clave: 'x', nombre: 'X', pedidos: 1, total: 0, efectivo: 0, transferencia: 0, tarjeta: 0, por_cobrar: 0, ...p,
})

describe('cierre de caja', () => {
  it('suma por canal y deja todos los canales aunque no tengan ventas', () => {
    const r = resumirCanales([
      fila({ canal: 'local', clave: 'a', pedidos: 2, total: 105, efectivo: 50, transferencia: 55 }),
      fila({ canal: 'local', clave: 'b', pedidos: 1, total: 20, tarjeta: 20 }),
      fila({ canal: 'sector', clave: 's', pedidos: 1, total: 62.5, por_cobrar: 62.5 }),
    ])
    expect(r.canales.map((c) => c.canal)).toEqual(['local', 'sector', 'web', 'whatsapp', 'mayoristas'])
    const local = r.canales[0]
    expect(local).toMatchObject({ total: 125, pedidos: 3, efectivo: 50, transferencia: 55, tarjeta: 20 })
    expect(r.canales[1]).toMatchObject({ total: 62.5, porCobrar: 62.5 })
    expect(r.canales[2]).toMatchObject({ total: 0, pedidos: 0, filas: [] })
    expect(r.totalGeneral).toBe(187.5)
    expect(r.pedidosGeneral).toBe(4)
  })

  it('arma el periodo con el último día incluido', () => {
    const p = periodo('2026-11-18', '2026-11-19')
    expect(p).not.toBeNull()
    expect(aFechaInput(p!.desde)).toBe('2026-11-18')
    expect(aFechaInput(p!.hasta)).toBe('2026-11-20')
    expect(periodo('2026-11-19', '2026-11-18')).toBeNull()
    expect(periodo('', '')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { construirMensaje, soloDigitos, urlWhatsApp } from './whatsapp'

describe('whatsapp', () => {
  it('arma el mensaje con detalle y total', () => {
    const m = construirMensaje({
      plantilla: 'Hola, quiero este pedido:',
      numero: 12,
      nombre: 'Ana',
      telefono: '0991234567',
      nota: '',
      lineas: [{ descripcion: 'Runner · Negro · talla 40', cantidad: 2, precio: 89.9 }],
      total: 179.8,
      formato: (n) => `$${n.toFixed(2)}`,
    })
    expect(m).toContain('Pedido #12')
    expect(m).toContain('2 × Runner · Negro · talla 40 — $179.80')
    expect(m).toContain('Total: $179.80')
    expect(m).not.toContain('Nota:')
  })
  it('normaliza el teléfono y codifica el texto', () => {
    expect(soloDigitos('+593 99-123 4567')).toBe('593991234567')
    expect(urlWhatsApp('+593 99', 'a b\nc')).toBe('https://wa.me/59399?text=a%20b%0Ac')
  })
})

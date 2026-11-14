import { describe, expect, it } from 'vitest'
import { inicioDeRol, puedeEntrar, ROLES_PANEL } from './roles'

describe('inicioDeRol', () => {
  it('lleva cada rol aprobado a su pantalla', () => {
    expect(inicioDeRol('admin', 'aprobado')).toBe('/admin')
    expect(inicioDeRol('bodeguero', 'aprobado')).toBe('/admin/bodega')
    expect(inicioDeRol('vendedor', 'aprobado')).toBe('/admin/local')
    expect(inicioDeRol('mayorista', 'aprobado')).toBe('/mayorista')
    expect(inicioDeRol('mayorista_sector', 'aprobado')).toBe('/sector')
  })

  it('sin aprobar o sin perfil va a la pantalla de estado', () => {
    expect(inicioDeRol('bodeguero', 'pendiente')).toBe('/cuenta')
    expect(inicioDeRol('admin', 'suspendido')).toBe('/cuenta')
    expect(inicioDeRol(null, null)).toBe('/cuenta')
  })
})

describe('puedeEntrar', () => {
  it('el panel admite admin, bodeguero y vendedor aprobados', () => {
    expect(puedeEntrar('bodeguero', 'aprobado', ROLES_PANEL)).toBe(true)
    expect(puedeEntrar('vendedor', 'aprobado', ROLES_PANEL)).toBe(true)
    expect(puedeEntrar('mayorista', 'aprobado', ROLES_PANEL)).toBe(false)
    expect(puedeEntrar('mayorista_sector', 'aprobado', ROLES_PANEL)).toBe(false)
    expect(puedeEntrar('bodeguero', 'pendiente', ROLES_PANEL)).toBe(false)
  })

  it('una ruta solo de admin no deja pasar al bodeguero', () => {
    expect(puedeEntrar('bodeguero', 'aprobado', ['admin'])).toBe(false)
    expect(puedeEntrar('admin', 'aprobado', ['admin'])).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { datosClienteSchema, datosDesdePerfil, DATOS_CLIENTE_VACIOS } from './datosCliente'

const valido = { nombre: 'Ana Pérez', documento: '0912345678', telefono: '0991234567', correo: 'ana@correo.com', direccion: 'Av. 9 de Octubre 123', nota: '' }

describe('datos del cliente', () => {
  it('acepta cédula de 10 dígitos y RUC de 13', () => {
    expect(datosClienteSchema.safeParse(valido).success).toBe(true)
    expect(datosClienteSchema.safeParse({ ...valido, documento: '0912345678001' }).success).toBe(true)
  })
  it('rechaza documentos con letras o longitud incorrecta', () => {
    expect(datosClienteSchema.safeParse({ ...valido, documento: '12345' }).success).toBe(false)
    expect(datosClienteSchema.safeParse({ ...valido, documento: '09123456AB' }).success).toBe(false)
  })
  it('exige correo y dirección', () => {
    expect(datosClienteSchema.safeParse({ ...valido, correo: 'ana' }).success).toBe(false)
    expect(datosClienteSchema.safeParse({ ...valido, direccion: 'x' }).success).toBe(false)
  })
  it('rellena desde el perfil del mayorista y tolera datos faltantes', () => {
    const d = datosDesdePerfil({ nombre: 'Luis', cedula_ruc: '1144180142', telefono: '57314', correo: 'l@t.co', direccion: null })
    expect(d.nombre).toBe('Luis')
    expect(d.documento).toBe('1144180142')
    expect(d.direccion).toBe('')
    expect(datosDesdePerfil(null)).toEqual(DATOS_CLIENTE_VACIOS)
  })
})

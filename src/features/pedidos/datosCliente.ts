import { z } from 'zod'

/**
 * Datos que se piden al hacer un pedido. En Ecuador el documento es la cédula (10 dígitos) o el RUC (13).
 * Solo se valida el formato: así también pasan clientes de otros países con un documento de 10 dígitos.
 */
export const datosClienteSchema = z.object({
  nombre: z.string().trim().min(3, 'Ingresa tu nombre completo'),
  documento: z.string().trim().regex(/^([0-9]{10}|[0-9]{13})$/, 'Cédula (10 dígitos) o RUC (13 dígitos), solo números'),
  telefono: z.string().trim().regex(/^[0-9+() -]{7,20}$/, 'Ingresa un celular válido'),
  correo: z.string().trim().min(1, 'Ingresa tu correo').email('Correo no válido'),
  direccion: z.string().trim().min(5, 'Ingresa tu dirección de entrega').max(200, 'Máximo 200 caracteres'),
  nota: z.string().max(500, 'Máximo 500 caracteres'),
})

export type DatosCliente = z.infer<typeof datosClienteSchema>

export const DATOS_CLIENTE_VACIOS: DatosCliente = { nombre: '', documento: '', telefono: '', correo: '', direccion: '', nota: '' }

interface PerfilBasico {
  nombre: string
  cedula_ruc: string | null
  telefono: string | null
  correo: string | null
  direccion: string | null
}

/** Rellena el formulario con los datos de la cuenta (mayoristas). */
export function datosDesdePerfil(p: PerfilBasico | null | undefined): DatosCliente {
  if (!p) return DATOS_CLIENTE_VACIOS
  return {
    nombre: p.nombre ?? '',
    documento: p.cedula_ruc ?? '',
    telefono: p.telefono ?? '',
    correo: p.correo ?? '',
    direccion: p.direccion ?? '',
    nota: '',
  }
}

import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Ingresa tu correo').email('Correo no válido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const registroSchema = z
  .object({
    nombre: z.string().trim().min(3, 'Ingresa tu nombre completo'),
    negocio: z.string().trim().min(2, 'Ingresa el nombre de tu negocio'),
    cedula_ruc: z.string().trim().regex(/^[0-9]{10}(001)?$|^[0-9]{13}$/, 'Cédula (10 dígitos) o RUC (13 dígitos)'),
    telefono: z.string().trim().regex(/^\+?[0-9]{9,15}$/, 'WhatsApp con código de país, solo números. Ej. 593991234567'),
    ciudad: z.string().trim().min(2, 'Ingresa tu ciudad'),
    email: z.string().min(1, 'Ingresa tu correo').email('Correo no válido'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((v) => v.password === v.confirmar, { path: ['confirmar'], message: 'Las contraseñas no coinciden' })

export type RegistroValues = z.infer<typeof registroSchema>

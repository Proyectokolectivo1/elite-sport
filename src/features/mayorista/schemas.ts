import { z } from 'zod'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido')

export const seccionSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa el nombre de tu tienda').max(60, 'Máximo 60 caracteres'),
  slug: z
    .string()
    .trim()
    .min(3, 'Mínimo 3 caracteres')
    .max(40, 'Máximo 40 caracteres')
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  color_primario: hex,
  color_acento: hex,
  whatsapp: z.string().trim().regex(/^$|^\+?[0-9]{8,15}$/, 'Solo dígitos con código de país. Ej. 593991234567'),
  plantilla_mensaje: z.string().trim().min(5, 'Escribe un saludo para tus pedidos').max(300, 'Máximo 300 caracteres'),
})

export type SeccionValues = z.infer<typeof seccionSchema>

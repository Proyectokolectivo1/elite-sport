import { z } from 'zod'

export const configuracionSchema = z.object({
  nombre_negocio: z.string().trim().min(2, 'Ingresa el nombre del negocio'),
  ciudad: z.string().trim().min(2, 'Ingresa la ciudad'),
  moneda_codigo: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'Código ISO de 3 letras, ej. USD'),
  moneda_simbolo: z.string().trim().min(1, 'Ingresa el símbolo').max(4, 'Máximo 4 caracteres'),
  moneda_decimales: z.number({ message: 'Número entre 0 y 4' }).int().min(0, 'Mínimo 0').max(4, 'Máximo 4'),
  locale: z.string().trim().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Formato es-EC, en-US…'),
  mayorista_dias_inactividad: z.number({ message: 'Número de días' }).int('Debe ser un número entero').min(7, 'Mínimo 7 días').max(365, 'Máximo 365 días'),
  whatsapp_principal: z.string().trim().regex(/^$|^\+?[0-9]{8,15}$/, 'Solo dígitos con código de país, ej. 593991234567'),
})

export type ConfiguracionValues = z.infer<typeof configuracionSchema>

import { z } from 'zod'

export const CANALES = ['local', 'sector', 'web', 'whatsapp', 'mayoristas'] as const
export type Canal = (typeof CANALES)[number]

export const filaVentasSchema = z.object({
  canal: z.enum(CANALES),
  clave: z.string(),
  nombre: z.string(),
  pedidos: z.number(),
  total: z.coerce.number(),
  efectivo: z.coerce.number(),
  transferencia: z.coerce.number(),
  tarjeta: z.coerce.number(),
  por_cobrar: z.coerce.number(),
})

export const resumenVentasSchema = z.object({ filas: z.array(filaVentasSchema) })

export type FilaVentas = z.infer<typeof filaVentasSchema>

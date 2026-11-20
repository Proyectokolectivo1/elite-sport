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
  /** Punto físico: quiénes vendieron en ese local. */
  detalle: z.string().nullable().optional(),
})

export const resumenVentasSchema = z.object({
  filas: z.array(filaVentasSchema),
  por_cerrar: z.object({ pedidos: z.number(), total: z.coerce.number() }).default({ pedidos: 0, total: 0 }),
})

export type FilaVentas = z.infer<typeof filaVentasSchema>
export interface ResumenVentas {
  filas: FilaVentas[]
  porCerrar: { pedidos: number; total: number }
}

import { z } from 'zod'

export const MOTIVOS = [
  { value: 'talla', label: 'Talla equivocada' },
  { value: 'defecto', label: 'Defecto del producto' },
  { value: 'no_gusto', label: 'No le gustó' },
  { value: 'error_pedido', label: 'Error en el pedido' },
  { value: 'otro', label: 'Otro' },
] as const

export const devolucionSchema = z.object({
  motivo: z.enum(['talla', 'defecto', 'no_gusto', 'error_pedido', 'otro']),
  reintegrar: z.boolean(),
  nota: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
})
export type DevolucionValues = z.infer<typeof devolucionSchema>

export const resultadoDevolucionSchema = z.object({
  id: z.string(),
  numero: z.number(),
  total: z.coerce.number(),
  pares: z.number(),
})

export const nombreMotivo = (m: string) => MOTIVOS.find((x) => x.value === m)?.label ?? m

import { z } from 'zod'

export const piezaSchema = z.enum(['par', 'derecho', 'izquierdo'])
export type Pieza = z.infer<typeof piezaSchema>

/** Pieza de exhibición tal como la ve admin o bodega (listar_exhibiciones). */
export const exhibicionSchema = z.object({
  id: z.string(),
  variante_id: z.string(),
  producto_id: z.string(),
  producto: z.string(),
  color: z.string(),
  talla: z.string(),
  local_id: z.string(),
  local: z.string(),
  pieza: piezaSchema,
  estado: z.enum(['en_exhibicion', 'reservada', 'vendida']),
  pedido_numero: z.number().nullable(),
})
export const listaExhibicionSchema = z.array(exhibicionSchema)
export type Exhibicion = z.infer<typeof exhibicionSchema>

/** Pieza disponible tal como la ve el vendedor: sin stock ni cantidades de bodega. */
export const piezaVendedorSchema = z.object({
  id: z.string(),
  variante_id: z.string(),
  pieza: piezaSchema,
  local_id: z.string(),
  local: z.string(),
  propia: z.boolean(),
})
export const listaPiezaVendedorSchema = z.array(piezaVendedorSchema)
export type PiezaVendedor = z.infer<typeof piezaVendedorSchema>

export const altaExhibicionSchema = z.object({
  varianteId: z.string().min(1, 'Elige el producto y la talla'),
  localId: z.string().min(1, 'Elige el local'),
  pieza: piezaSchema,
})
export type AltaExhibicionValues = z.infer<typeof altaExhibicionSchema>

/** Pieza de exhibición que se asigna al crear el producto: color, talla, pieza y local. */
export interface FilaExhibicion {
  clave: string
  color: string
  talla: string
  pieza: Pieza
  localId: string
}

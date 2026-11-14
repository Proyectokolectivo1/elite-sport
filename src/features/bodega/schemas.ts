import { z } from 'zod'

const rol = z.enum(['admin', 'mayorista', 'bodeguero', 'vendedor', 'mayorista_sector'])
const estadoPedido = z.enum(['nuevo', 'confirmado', 'entregado', 'cancelado', 'liquidado'])
const tipoPedido = z.enum(['minorista', 'mayorista', 'lead_tienda', 'mostrador', 'consignacion'])

/** Línea que devuelve listar_pedidos_bodega: sin precios. */
export const lineaBodegaSchema = z.object({
  id: z.string(),
  variante_id: z.string(),
  descripcion: z.string(),
  cantidad: z.number(),
  cantidad_entregada: z.number().nullable(),
  cantidad_vendida: z.number().nullable(),
  cantidad_devuelta: z.number().nullable(),
  stock: z.number(),
})

export const pedidoBodegaSchema = z.object({
  id: z.string(),
  numero: z.number(),
  tipo: tipoPedido,
  estado: estadoPedido,
  creado_en: z.string(),
  despachado_en: z.string().nullable(),
  liquidado_en: z.string().nullable(),
  nota: z.string().nullable(),
  solicitante_id: z.string().nullable(),
  solicitante_nombre: z.string().nullable(),
  solicitante_rol: rol.nullable(),
  cliente_nombre: z.string(),
  cliente_telefono: z.string(),
  cliente_direccion: z.string().nullable(),
  lineas: z.array(lineaBodegaSchema),
})

export const listaBodegaSchema = z.array(pedidoBodegaSchema)

export const parEnPoderSchema = z.object({
  variante_id: z.string(),
  producto_id: z.string(),
  producto: z.string(),
  color: z.string(),
  talla: z.string(),
  talla_orden: z.number(),
  en_poder: z.number(),
  precio: z.number(),
})

export const paresEnPoderSchema = z.array(parEnPoderSchema)

export const resultadoCierreSchema = z.object({
  id: z.string(),
  venta_sin_registrar: z.number().nullable(),
})

export const resultadoVentaSchema = z.object({ id: z.string(), numero: z.number(), total: z.number() })
export const resultadoSolicitudSchema = z.object({ id: z.string(), numero: z.number() })

/** Edición de un integrante del equipo por el admin. */
export const integranteSchema = z.object({
  rol: z.enum(['mayorista', 'mayorista_sector', 'bodeguero', 'vendedor']),
  estado: z.enum(['pendiente', 'aprobado', 'rechazado', 'suspendido']),
})
export type IntegranteValues = z.infer<typeof integranteSchema>

export const notaPedidoSchema = z.object({ nota: z.string().max(500, 'Máximo 500 caracteres') })
export type NotaPedidoValues = z.infer<typeof notaPedidoSchema>

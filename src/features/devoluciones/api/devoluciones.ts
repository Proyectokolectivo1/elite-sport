import { supabase } from '@/lib/supabase'
import { resultadoDevolucionSchema, type DevolucionValues } from '../schemas'
import type { LineaDevolvible } from '../logica'

export interface PedidoDevolvible {
  id: string
  numero: number
  tipo: string
  cliente: string
  telefono: string
  total: number
  creadoEn: string
  lineas: LineaDevolvible[]
}

/** Pedidos entregados y ventas de vendedores ya cerradas por bodega, con lo que ya se devolvió de cada línea. */
export async function pedidosDevolvibles(): Promise<PedidoDevolvible[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, tipo, cliente_nombre, cliente_telefono, total, creado_en, solicitante:perfiles!pedidos_solicitante_id_fkey(nombre, negocio, rol), pedidos_detalle!pedidos_detalle_pedido_id_fkey(id, descripcion, cantidad, cantidad_vendida, precio_unitario, devoluciones_detalle(cantidad))')
    .or('and(estado.eq.entregado,tipo.neq.consignacion),and(estado.eq.liquidado,tipo.eq.consignacion,total.gt.0)')
    .order('creado_en', { ascending: false })
    .limit(200)
  if (error) throw error
  return data
    .filter((p) => p.tipo !== 'consignacion' || p.solicitante?.rol === 'vendedor')
    .map((p) => ({
    id: p.id,
    numero: p.numero,
    tipo: p.tipo,
    cliente: p.cliente_nombre,
    telefono: p.cliente_telefono,
    total: p.total,
    creadoEn: p.creado_en,
    lineas: p.pedidos_detalle.map((d) => ({
      id: d.id,
      descripcion: d.descripcion,
      cantidad: p.tipo === 'consignacion' ? (d.cantidad_vendida ?? 0) : d.cantidad,
      precio: d.precio_unitario,
      devuelta: d.devoluciones_detalle.reduce((s, x) => s + x.cantidad, 0),
    })),
  }))
}

export interface DevolucionFila {
  id: string
  numero: number
  pedidoNumero: number | null
  cliente: string
  motivo: string
  reintegrado: boolean
  nota: string | null
  total: number
  creadoEn: string
  lineas: { id: string; descripcion: string; cantidad: number }[]
}

export async function listarDevoluciones(): Promise<DevolucionFila[]> {
  const { data, error } = await supabase
    .from('devoluciones')
    .select('id, numero, motivo, reintegrado, nota, total, creado_en, pedidos(numero, cliente_nombre), devoluciones_detalle(id, descripcion, cantidad)')
    .order('creado_en', { ascending: false })
    .limit(100)
  if (error) throw error
  return data.map((d) => ({
    id: d.id,
    numero: d.numero,
    pedidoNumero: d.pedidos?.numero ?? null,
    cliente: d.pedidos?.cliente_nombre ?? '',
    motivo: d.motivo,
    reintegrado: d.reintegrado,
    nota: d.nota,
    total: d.total,
    creadoEn: d.creado_en,
    lineas: d.devoluciones_detalle,
  }))
}

export async function registrarDevolucion(
  pedidoId: string,
  lineas: { detalleId: string; cantidad: number }[],
  v: DevolucionValues,
): Promise<{ numero: number; total: number; pares: number }> {
  const { data, error } = await supabase.rpc('registrar_devolucion', {
    p_pedido: pedidoId,
    p_lineas: lineas.map((l) => ({ detalle_id: l.detalleId, cantidad: l.cantidad })),
    p_motivo: v.motivo,
    p_reintegrar: v.reintegrar,
    p_nota: v.nota || undefined,
  })
  if (error) throw error
  return resultadoDevolucionSchema.parse(data)
}

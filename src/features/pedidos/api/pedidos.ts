import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'

export type TipoPedido = Enums<'tipo_pedido'>
export type EstadoPedido = Enums<'estado_pedido'>

export interface PedidoFila {
  id: string
  numero: number
  tipo: TipoPedido
  estado: EstadoPedido
  cliente: string
  telefono: string
  origen: string
  total: number
  moneda: string
  nota: string | null
  creadoEn: string
  correo: string | null
  direccion: string | null
  documento: string | null
  metodoPago: string | null
}

export async function listarPedidos(): Promise<PedidoFila[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, tipo, estado, cliente_nombre, cliente_telefono, cliente_correo, cliente_direccion, cliente_documento, metodo_pago, total, moneda, nota, creado_en, tiendas(nombre), perfiles(nombre, negocio)')
    .order('creado_en', { ascending: false })
    .limit(300)
  if (error) throw error
  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    tipo: p.tipo,
    estado: p.estado,
    cliente: p.cliente_nombre,
    telefono: p.cliente_telefono,
    origen: p.perfiles?.negocio || p.perfiles?.nombre || p.tiendas?.nombre || 'Tienda principal',
    total: p.total,
    moneda: p.moneda,
    nota: p.nota,
    creadoEn: p.creado_en,
    correo: p.cliente_correo,
    direccion: p.cliente_direccion,
    documento: p.cliente_documento,
    metodoPago: p.metodo_pago,
  }))
}

export interface LineaPedido {
  id: string
  descripcion: string
  cantidad: number
  precio: number
}

export async function listarDetallePedido(pedidoId: string): Promise<LineaPedido[]> {
  const { data, error } = await supabase.from('pedidos_detalle').select('id, descripcion, cantidad, precio_unitario').eq('pedido_id', pedidoId)
  if (error) throw error
  return data.map((d) => ({ id: d.id, descripcion: d.descripcion, cantidad: d.cantidad, precio: d.precio_unitario }))
}

export type AccionPedido = 'confirmar' | 'cancelar' | 'entregar'

export async function ejecutarAccionPedido(accion: AccionPedido, pedidoId: string): Promise<void> {
  const rpc =
    accion === 'confirmar' ? supabase.rpc('confirmar_pedido', { p_pedido: pedidoId })
    : accion === 'cancelar' ? supabase.rpc('cancelar_pedido', { p_pedido: pedidoId })
    : supabase.rpc('entregar_pedido', { p_pedido: pedidoId })
  const { error } = await rpc
  if (error) throw error
}

import { supabase } from '@/lib/supabase'

export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta'

export interface VentaEntrada {
  items: { variante_id: string; cantidad: number; precio: number }[]
  metodoPago: MetodoPago
  nombre?: string
  telefono?: string
  correo?: string
  documento?: string
  nota?: string
}

/** Registra una venta hecha en el punto físico: queda entregada y descuenta el inventario. */
export async function registrarVentaMostrador(v: VentaEntrada): Promise<{ id: string; numero: number; total: number }> {
  const { data, error } = await supabase.rpc('registrar_venta_mostrador', {
    p_items: v.items,
    p_metodo_pago: v.metodoPago,
    p_cliente_nombre: v.nombre || undefined,
    p_cliente_telefono: v.telefono || undefined,
    p_cliente_correo: v.correo || undefined,
    p_cliente_documento: v.documento || undefined,
    p_nota: v.nota || undefined,
  })
  if (error) throw error
  const r = data as { id: string; numero: number; total: number }
  return { id: r.id, numero: r.numero, total: Number(r.total) }
}

export interface LineaPorCerrar {
  id: string
  descripcion: string
  cantidad: number
  /** Precio que puso el vendedor. */
  precio: number
  /** Precio de lista de la entrega de bodega. */
  precioLista: number | null
}

export interface VentaPorCerrar {
  id: string
  numero: number
  vendedor: string
  /** Local donde se hizo la venta (Élite, KZ...). */
  local: string | null
  cliente: string
  documento: string | null
  metodoPago: MetodoPago
  total: number
  nota: string | null
  creadoEn: string
  lineas: LineaPorCerrar[]
}

/** Ventas del local que el vendedor dejó listas y esperan el cierre del admin. */
export async function listarVentasPorCerrar(): Promise<VentaPorCerrar[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, numero, cliente_nombre, cliente_documento, metodo_pago, total, nota, creado_en, solicitante:perfiles!pedidos_solicitante_id_fkey(nombre, negocio), local:locales(nombre), pedidos_detalle(id, descripcion, cantidad, precio_unitario, precio_lista)')
    .eq('tipo', 'mostrador')
    .eq('estado', 'nuevo')
    .order('creado_en', { ascending: true })
    .limit(200)
  if (error) throw error
  return data.map((p) => ({
    id: p.id,
    numero: p.numero,
    vendedor: p.solicitante?.nombre || p.solicitante?.negocio || 'Sin nombre',
    local: p.local?.nombre ?? null,
    cliente: p.cliente_nombre,
    documento: p.cliente_documento,
    metodoPago: p.metodo_pago ?? 'efectivo',
    total: p.total,
    nota: p.nota,
    creadoEn: p.creado_en,
    lineas: [...p.pedidos_detalle]
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion))
      .map((d) => ({ id: d.id, descripcion: d.descripcion, cantidad: d.cantidad, precio: d.precio_unitario, precioLista: d.precio_lista })),
  }))
}

/** El admin cierra la venta: fija el precio final de cada línea y la forma de pago. */
export async function cerrarVentaLocal(v: { pedidoId: string; precios: { detalle_id: string; precio: number }[]; metodoPago: MetodoPago }): Promise<{ numero: number; total: number }> {
  const { data, error } = await supabase.rpc('cerrar_venta_local', { p_pedido: v.pedidoId, p_lineas: v.precios, p_metodo_pago: v.metodoPago })
  if (error) throw error
  const r = data as { numero: number; total: number | string }
  return { numero: r.numero, total: Number(r.total) }
}

export async function anularVentaLocal(pedidoId: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_pedido', { p_pedido: pedidoId })
  if (error) throw error
}

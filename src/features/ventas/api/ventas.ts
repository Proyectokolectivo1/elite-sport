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

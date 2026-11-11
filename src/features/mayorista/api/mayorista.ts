import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import type { Especial } from '../precio'

export type MiTienda = Tables<'tiendas'>

export async function obtenerMiTienda(userId: string): Promise<MiTienda | null> {
  const { data, error } = await supabase.from('tiendas').select('*').eq('propietario_id', userId).maybeSingle()
  if (error) throw error
  return data
}

export interface MiTiendaEntrada {
  nombre: string
  slug: string
  color_primario: string
  color_acento: string
  whatsapp: string | null
  plantilla_mensaje: string
}

export async function actualizarMiTienda(id: string, v: MiTiendaEntrada): Promise<void> {
  const { error } = await supabase.from('tiendas').update(v).eq('id', id)
  if (error) throw error
}

export async function subirImagenTienda(tiendaId: string, tipo: 'logo' | 'banner', blob: Blob): Promise<void> {
  const ruta = `${tiendaId}/${tipo}-${crypto.randomUUID()}.webp`
  const { error: e1 } = await supabase.storage.from('tiendas').upload(ruta, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (e1) throw e1
  const { data } = supabase.storage.from('tiendas').getPublicUrl(ruta)
  const { error } = await supabase.from('tiendas').update(tipo === 'logo' ? { logo_url: data.publicUrl } : { banner_url: data.publicUrl }).eq('id', tiendaId)
  if (error) throw error
}

export async function quitarImagenTienda(tiendaId: string, tipo: 'logo' | 'banner'): Promise<void> {
  const { error } = await supabase.from('tiendas').update(tipo === 'logo' ? { logo_url: null } : { banner_url: null }).eq('id', tiendaId)
  if (error) throw error
}

// ---- Costos y precios de venta ----
export interface CostoProducto {
  productoId: string
  base: number | null
  especial?: Especial
}

/** Precio mayorista base y especial de este mayorista (solo lo leen mayoristas aprobados). */
export async function listarCostos(userId: string): Promise<CostoProducto[]> {
  const [base, esp] = await Promise.all([
    supabase.from('precios_mayorista').select('producto_id, precio'),
    supabase.from('precios_especiales_mayorista').select('producto_id, precio, descuento_pct').eq('mayorista_id', userId),
  ])
  if (base.error) throw base.error
  if (esp.error) throw esp.error
  const especiales = new Map(esp.data.map((e) => [e.producto_id, { precio: e.precio, descuentoPct: e.descuento_pct }]))
  return base.data.map((b) => ({ productoId: b.producto_id, base: b.precio, especial: especiales.get(b.producto_id) }))
}

export async function listarPreciosTienda(tiendaId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('precios_tienda').select('producto_id, precio').eq('tienda_id', tiendaId)
  if (error) throw error
  return Object.fromEntries(data.map((p) => [p.producto_id, p.precio]))
}

export interface CambioPrecio {
  productoId: string
  /** null = volver al precio al público */
  precio: number | null
}

export async function guardarPreciosTienda(tiendaId: string, cambios: CambioPrecio[]): Promise<void> {
  const poner = cambios.filter((c) => c.precio !== null).map((c) => ({ tienda_id: tiendaId, producto_id: c.productoId, precio: c.precio as number }))
  const quitar = cambios.filter((c) => c.precio === null).map((c) => c.productoId)
  if (poner.length > 0) {
    const { error } = await supabase.from('precios_tienda').upsert(poner, { onConflict: 'tienda_id,producto_id' })
    if (error) throw error
  }
  if (quitar.length > 0) {
    const { error } = await supabase.from('precios_tienda').delete().eq('tienda_id', tiendaId).in('producto_id', quitar)
    if (error) throw error
  }
}

// ---- Pedido al admin ----
export async function crearPedidoMayorista(v: {
  nombre: string
  telefono: string
  correo: string
  direccion: string
  documento: string
  nota: string
  items: { variante_id: string; cantidad: number }[]
}): Promise<{ id: string; numero: number; total: number }> {
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_tipo: 'mayorista',
    p_cliente_nombre: v.nombre,
    p_cliente_telefono: v.telefono,
    p_items: v.items,
    p_nota: v.nota || undefined,
    p_cliente_correo: v.correo,
    p_cliente_direccion: v.direccion,
    p_cliente_documento: v.documento,
  })
  if (error) throw error
  const r = data as { id: string; numero: number; total: number }
  return { id: r.id, numero: r.numero, total: Number(r.total) }
}

export async function cancelarMiPedido(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_pedido', { p_pedido: id })
  if (error) throw error
}

/** Fecha límite para hacer un pedido y mantener activo el catálogo del mayorista actual. */
export async function obtenerMiPlazo(): Promise<{ venceEn: string; ultimoPedido: string | null; diasRestantes: number } | null> {
  const { data, error } = await supabase.rpc('actividad_mayorista')
  if (error) throw error
  const f = data[0]
  return f ? { venceEn: f.vence_en, ultimoPedido: f.ultimo_pedido, diasRestantes: Math.ceil((new Date(f.vence_en).getTime() - Date.now()) / 86_400_000) } : null
}

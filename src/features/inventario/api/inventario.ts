import { supabase } from '@/lib/supabase'
import type { Enums, Json } from '@/types/database'
import type { GrupoTalla } from '@/features/catalogo/api/catalogo'

export type MotivoMovimiento = Enums<'motivo_movimiento'>

// ---- Curvas ----
export interface Curva {
  id: string
  nombre: string
  grupo: GrupoTalla
  detalle: { talla_id: string; pares: number }[]
}

export async function listarCurvas(): Promise<Curva[]> {
  const [c, d] = await Promise.all([
    supabase.from('curvas_tallas').select('*').order('nombre'),
    supabase.from('curvas_tallas_detalle').select('*'),
  ])
  if (c.error) throw c.error
  if (d.error) throw d.error
  return c.data.map((x) => ({
    id: x.id,
    nombre: x.nombre,
    grupo: x.grupo,
    detalle: d.data.filter((l) => l.curva_id === x.id).map((l) => ({ talla_id: l.talla_id, pares: l.pares })),
  }))
}

export async function crearCurva(nombre: string, grupo: GrupoTalla, detalle: { talla_id: string; pares: number }[]): Promise<void> {
  const { data, error } = await supabase.from('curvas_tallas').insert({ nombre: nombre.trim(), grupo }).select('id').single()
  if (error) throw error
  const { error: e2 } = await supabase.from('curvas_tallas_detalle').insert(detalle.map((d) => ({ ...d, curva_id: data.id })))
  if (e2) {
    await supabase.from('curvas_tallas').delete().eq('id', data.id)
    throw e2
  }
}

export async function eliminarCurva(id: string): Promise<void> {
  const { error } = await supabase.from('curvas_tallas').delete().eq('id', id)
  if (error) throw error
}

// ---- Ingreso ----
export interface IngresoEntrada {
  tipo: Enums<'tipo_ingreso'>
  productoId: string
  cajas: number
  color: string
  proveedor?: string
  referencia?: string
  nota?: string
  lineas: { talla_id: string; pares: number; total: number }[]
}

export async function registrarIngreso(v: IngresoEntrada): Promise<string> {
  const lineas: Json = v.lineas.filter((l) => l.total > 0)
  const { data, error } = await supabase.rpc('registrar_ingreso_inventario', {
    p_tipo: v.tipo,
    p_producto_id: v.productoId,
    p_num_cajas: v.cajas,
    p_lineas: lineas,
    p_color: v.color,
    p_proveedor: v.proveedor || undefined,
    p_referencia: v.referencia || undefined,
    p_nota: v.nota || undefined,
  })
  if (error) throw error
  return data
}

// ---- Existencias y ajustes ----
export interface Existencia {
  id: string
  productoId: string
  producto: string
  color: string
  talla: string
  tallaOrden: number
  sku: string
  stock: number
}

export async function listarExistencias(): Promise<Existencia[]> {
  const { data, error } = await supabase
    .from('variantes_producto')
    .select('id, producto_id, color, sku, stock, productos(nombre), tallas(etiqueta, orden)')
  if (error) throw error
  return data
    .map((v) => ({
      id: v.id,
      productoId: v.producto_id,
      producto: v.productos?.nombre ?? '',
      color: v.color,
      talla: v.tallas?.etiqueta ?? '',
      tallaOrden: v.tallas?.orden ?? 0,
      sku: v.sku,
      stock: v.stock,
    }))
    .sort((a, b) => a.producto.localeCompare(b.producto) || a.color.localeCompare(b.color) || a.tallaOrden - b.tallaOrden)
}

export async function ajustarStock(varianteId: string, delta: number, nota: string): Promise<void> {
  const { error } = await supabase.rpc('ajustar_stock', { p_variante: varianteId, p_delta: delta, p_nota: nota })
  if (error) throw error
}

// ---- Movimientos ----
export interface Movimiento {
  id: string
  creadoEn: string
  delta: number
  motivo: MotivoMovimiento
  nota: string | null
  producto: string
  color: string
  talla: string
}

export async function listarMovimientos(limite = 300): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos_inventario')
    .select('id, creado_en, delta, motivo, nota, variantes_producto(color, productos(nombre), tallas(etiqueta))')
    .order('creado_en', { ascending: false })
    .limit(limite)
  if (error) throw error
  return data.map((m) => ({
    id: m.id,
    creadoEn: m.creado_en,
    delta: m.delta,
    motivo: m.motivo,
    nota: m.nota,
    producto: m.variantes_producto?.productos?.nombre ?? '',
    color: m.variantes_producto?.color ?? '',
    talla: m.variantes_producto?.tallas?.etiqueta ?? '',
  }))
}

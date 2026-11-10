import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'

export type EstadoPerfil = Enums<'estado_perfil'>

export interface Mayorista {
  id: string
  nombre: string
  negocio: string | null
  telefono: string | null
  correo: string | null
  cedulaRuc: string | null
  ciudad: string | null
  estado: EstadoPerfil
  creadoEn: string
  slug: string | null
}

export async function listarMayoristas(): Promise<Mayorista[]> {
  const [p, t] = await Promise.all([
    supabase.from('perfiles').select('*').eq('rol', 'mayorista').order('creado_en', { ascending: false }),
    supabase.from('tiendas').select('propietario_id, slug').not('propietario_id', 'is', null),
  ])
  if (p.error) throw p.error
  if (t.error) throw t.error
  const slugs = new Map(t.data.map((x) => [x.propietario_id, x.slug]))
  return p.data.map((x) => ({
    id: x.id,
    nombre: x.nombre,
    negocio: x.negocio,
    telefono: x.telefono,
    correo: x.correo,
    cedulaRuc: x.cedula_ruc,
    ciudad: x.ciudad,
    estado: x.estado,
    creadoEn: x.creado_en,
    slug: slugs.get(x.id) ?? null,
  }))
}

export async function cambiarEstadoMayorista(id: string, estado: EstadoPerfil): Promise<void> {
  const { error } = await supabase.from('perfiles').update({ estado }).eq('id', id)
  if (error) throw error
}

// ---- Precios especiales ----
export interface PrecioEspecial {
  id: string
  productoId: string
  precio: number | null
  descuentoPct: number | null
}

export async function listarEspeciales(mayoristaId: string): Promise<PrecioEspecial[]> {
  const { data, error } = await supabase.from('precios_especiales_mayorista').select('*').eq('mayorista_id', mayoristaId)
  if (error) throw error
  return data.map((x) => ({ id: x.id, productoId: x.producto_id, precio: x.precio, descuentoPct: x.descuento_pct }))
}

export type EspecialEntrada = { tipo: 'precio'; valor: number } | { tipo: 'descuento'; valor: number } | null

export async function guardarEspecial(productoId: string, mayoristaId: string, v: EspecialEntrada): Promise<void> {
  if (v === null) {
    const { error } = await supabase.from('precios_especiales_mayorista').delete().eq('producto_id', productoId).eq('mayorista_id', mayoristaId)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('precios_especiales_mayorista').upsert(
    {
      producto_id: productoId,
      mayorista_id: mayoristaId,
      precio: v.tipo === 'precio' ? v.valor : null,
      descuento_pct: v.tipo === 'descuento' ? v.valor : null,
    },
    { onConflict: 'producto_id,mayorista_id' },
  )
  if (error) throw error
}

import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

export type Tienda = Tables<'tiendas'>
export type GrupoTalla = Enums<'grupo_talla'>

/** Tienda principal (slug = null) o la de un mayorista. Solo lee tiendas activas. */
export async function obtenerTienda(slug: string | null): Promise<Tienda | null> {
  const q = supabase.from('tiendas').select('*').eq('activa', true)
  const { data, error } = await (slug ? q.eq('slug', slug) : q.eq('es_principal', true)).maybeSingle()
  if (error) throw error
  return data
}

/** Precios propios de la tienda de un mayorista (producto_id -> precio). */
export async function obtenerPreciosTienda(tiendaId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('precios_tienda').select('producto_id, precio').eq('tienda_id', tiendaId)
  if (error) throw error
  return Object.fromEntries(data.map((p) => [p.producto_id, p.precio]))
}

export interface VariantePublica {
  id: string
  color: string
  tallaId: string
  talla: string
  orden: number
  stock: number
}

export interface ProductoPublico {
  id: string
  slug: string
  nombre: string
  grupo: GrupoTalla
  descripcion: string | null
  /** Precio al público. El precio mayorista nunca se consulta desde aquí. */
  pvp: number
  destacado: boolean
  creadoEn: string
  marca: { id: string; nombre: string } | null
  categoria: { id: string; nombre: string } | null
  estilo: { id: string; nombre: string } | null
  imagenes: { color: string; url: string }[]
  variantes: VariantePublica[]
}

export async function obtenerCatalogoPublico(): Promise<ProductoPublico[]> {
  const [prods, imgs, vars] = await Promise.all([
    supabase.from('productos').select('*, marcas(id, nombre), categorias(id, nombre), estilos(id, nombre)').eq('activo', true).order('creado_en', { ascending: false }),
    supabase.from('imagenes_producto').select('producto_id, color, url, orden').order('orden'),
    supabase.from('variantes_producto').select('id, producto_id, color, stock, talla_id, tallas(etiqueta, orden)'),
  ])
  for (const r of [prods, imgs, vars]) if (r.error) throw r.error

  const imagenes = new Map<string, { color: string; url: string }[]>()
  for (const i of imgs.data ?? []) imagenes.set(i.producto_id, [...(imagenes.get(i.producto_id) ?? []), { color: i.color, url: i.url }])
  const variantes = new Map<string, VariantePublica[]>()
  for (const v of vars.data ?? []) {
    variantes.set(v.producto_id, [
      ...(variantes.get(v.producto_id) ?? []),
      { id: v.id, color: v.color, tallaId: v.talla_id, talla: v.tallas?.etiqueta ?? '', orden: v.tallas?.orden ?? 0, stock: v.stock },
    ])
  }

  return (prods.data ?? []).map((p) => ({
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    grupo: p.grupo,
    descripcion: p.descripcion,
    pvp: p.precio_publico,
    destacado: p.destacado,
    creadoEn: p.creado_en,
    marca: p.marcas,
    categoria: p.categorias,
    estilo: p.estilos,
    imagenes: imagenes.get(p.id) ?? [],
    variantes: (variantes.get(p.id) ?? []).sort((a, b) => a.orden - b.orden),
  }))
}

export interface PedidoCreado {
  id: string
  numero: number
  total: number
}

export async function crearPedidoPublico(v: {
  tiendaId: string | null
  esPrincipal: boolean
  nombre: string
  telefono: string
  correo: string
  direccion: string
  documento: string
  nota: string
  items: { variante_id: string; cantidad: number }[]
}): Promise<PedidoCreado> {
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_tipo: v.esPrincipal ? 'minorista' : 'lead_tienda',
    p_cliente_nombre: v.nombre,
    p_cliente_telefono: v.telefono,
    p_items: v.items,
    p_tienda_id: v.esPrincipal ? undefined : (v.tiendaId ?? undefined),
    p_nota: v.nota || undefined,
    p_cliente_correo: v.correo,
    p_cliente_direccion: v.direccion,
    p_cliente_documento: v.documento,
  })
  if (error) throw error
  const r = data as { id: string; numero: number; total: number }
  return { id: r.id, numero: r.numero, total: Number(r.total) }
}

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

export interface ImagenPublica {
  color: string
  /** Foto grande, para la ficha. */
  url: string
  /** Foto pequeña (480 px) para tarjetas y listas; las fotos antiguas no la tienen. */
  miniatura: string | null
}

export interface ProductoPublico {
  id: string
  slug: string
  nombre: string
  grupo: GrupoTalla
  descripcion: string | null
  /** Precio al público. El precio mayorista nunca se consulta desde aquí. */
  pvp: number
  /** Precio en la tienda activa: el del mayorista si lo fijó, si no el PVP. */
  precio: number
  destacado: boolean
  creadoEn: string
  marca: { id: string; nombre: string } | null
  categoria: { id: string; nombre: string } | null
  estilo: { id: string; nombre: string } | null
  imagenes: ImagenPublica[]
  variantes: VariantePublica[]
}

// Solo las columnas que se muestran: menos datos por la red y menos trabajo para la base.
const COLUMNAS_PRODUCTO = 'id, slug, nombre, grupo, descripcion, precio_publico, destacado, creado_en, marcas(id, nombre), categorias(id, nombre), estilos(id, nombre)'
const COLUMNAS_IMAGEN = 'producto_id, color, url, url_miniatura, orden'
const COLUMNAS_VARIANTE = 'id, producto_id, color, stock, talla_id, tallas(etiqueta, orden)'

type FilaProducto = {
  id: string
  slug: string
  nombre: string
  grupo: GrupoTalla
  descripcion: string | null
  precio_publico: number
  destacado: boolean
  creado_en: string
  marcas: { id: string; nombre: string } | null
  categorias: { id: string; nombre: string } | null
  estilos: { id: string; nombre: string } | null
}
type FilaImagen = { producto_id: string; color: string; url: string; url_miniatura: string | null }
type FilaVariante = { id: string; producto_id: string; color: string; stock: number; talla_id: string; tallas: { etiqueta: string; orden: number } | null }

function armarProductos(prods: FilaProducto[], imgs: FilaImagen[], vars: FilaVariante[], precios?: Map<string, number>): ProductoPublico[] {
  const imagenes = new Map<string, ImagenPublica[]>()
  for (const i of imgs) imagenes.set(i.producto_id, [...(imagenes.get(i.producto_id) ?? []), { color: i.color, url: i.url, miniatura: i.url_miniatura }])
  const variantes = new Map<string, VariantePublica[]>()
  for (const v of vars) {
    variantes.set(v.producto_id, [
      ...(variantes.get(v.producto_id) ?? []),
      { id: v.id, color: v.color, tallaId: v.talla_id, talla: v.tallas?.etiqueta ?? '', orden: v.tallas?.orden ?? 0, stock: v.stock },
    ])
  }
  return prods.map((p) => ({
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    grupo: p.grupo,
    descripcion: p.descripcion,
    pvp: p.precio_publico,
    precio: precios?.get(p.id) ?? p.precio_publico,
    destacado: p.destacado,
    creadoEn: p.creado_en,
    marca: p.marcas,
    categoria: p.categorias,
    estilo: p.estilos,
    imagenes: imagenes.get(p.id) ?? [],
    variantes: (variantes.get(p.id) ?? []).sort((a, b) => a.orden - b.orden),
  }))
}

/** Catálogo completo. Solo para pantallas que necesitan todo a la vez (pedido mayorista, ventas en tienda). */
export async function obtenerCatalogoPublico(): Promise<ProductoPublico[]> {
  const [prods, imgs, vars] = await Promise.all([
    supabase.from('productos').select(COLUMNAS_PRODUCTO).eq('activo', true).order('creado_en', { ascending: false }),
    supabase.from('imagenes_producto').select(COLUMNAS_IMAGEN).order('orden'),
    supabase.from('variantes_producto').select(COLUMNAS_VARIANTE),
  ])
  for (const r of [prods, imgs, vars]) if (r.error) throw r.error
  return armarProductos(prods.data ?? [], imgs.data ?? [], vars.data ?? [])
}

export interface FiltrosBusqueda {
  q?: string
  grupo?: GrupoTalla | ''
  marca?: string
  estilo?: string
  categoria?: string
  talla?: string
  min?: number | null
  max?: number | null
  destacado?: boolean
  orden?: string
}

export interface PaginaProductos {
  productos: ProductoPublico[]
  /** Total de productos que cumplen los filtros (no solo los de esta página). */
  total: number
}

/** Una página del catálogo, filtrada y ordenada en el servidor, con el precio de la tienda activa. */
export async function buscarProductos(tiendaId: string | null, f: FiltrosBusqueda, limite: number, desde: number): Promise<PaginaProductos> {
  const { data: filas, error } = await supabase.rpc('buscar_productos', {
    p_tienda_id: tiendaId ?? undefined,
    p_q: f.q || undefined,
    p_grupo: f.grupo || undefined,
    p_marca: f.marca || undefined,
    p_estilo: f.estilo || undefined,
    p_categoria: f.categoria || undefined,
    p_talla: f.talla || undefined,
    p_min: f.min ?? undefined,
    p_max: f.max ?? undefined,
    p_destacado: f.destacado,
    p_orden: f.orden || 'novedades',
    p_limite: limite,
    p_desde: desde,
  })
  if (error) throw error
  if (filas.length === 0) return { productos: [], total: 0 }

  const ids = filas.map((r) => r.id)
  const [prods, imgs, vars] = await Promise.all([
    supabase.from('productos').select(COLUMNAS_PRODUCTO).in('id', ids),
    supabase.from('imagenes_producto').select(COLUMNAS_IMAGEN).in('producto_id', ids).order('orden'),
    supabase.from('variantes_producto').select(COLUMNAS_VARIANTE).in('producto_id', ids),
  ])
  for (const r of [prods, imgs, vars]) if (r.error) throw r.error

  const precios = new Map(filas.map((r) => [r.id, Number(r.precio)]))
  const posicion = new Map(ids.map((id, i) => [id, i]))
  const productos = armarProductos(prods.data ?? [], imgs.data ?? [], vars.data ?? [], precios).sort(
    (a, b) => (posicion.get(a.id) ?? 0) - (posicion.get(b.id) ?? 0),
  )
  return { productos, total: Number(filas[0].total) }
}

/** Un producto por su slug, con su precio en la tienda activa. */
export async function obtenerProductoPorSlug(slug: string, tiendaId: string | null): Promise<ProductoPublico | null> {
  const { data: prod, error } = await supabase.from('productos').select(COLUMNAS_PRODUCTO).eq('slug', slug).eq('activo', true).maybeSingle()
  if (error) throw error
  if (!prod) return null
  const [imgs, vars, precio] = await Promise.all([
    supabase.from('imagenes_producto').select(COLUMNAS_IMAGEN).eq('producto_id', prod.id).order('orden'),
    supabase.from('variantes_producto').select(COLUMNAS_VARIANTE).eq('producto_id', prod.id),
    tiendaId ? supabase.from('precios_tienda').select('precio').eq('tienda_id', tiendaId).eq('producto_id', prod.id).maybeSingle() : Promise.resolve(null),
  ])
  if (imgs.error) throw imgs.error
  if (vars.error) throw vars.error
  if (precio?.error) throw precio.error
  const precios = precio?.data ? new Map([[prod.id, precio.data.precio]]) : undefined
  return armarProductos([prod], imgs.data ?? [], vars.data ?? [], precios)[0]
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

import { supabase } from '@/lib/supabase'
import { extensionDeTipo, type ImagenOptimizada } from '@/lib/imagen'
import { slugify } from '@/lib/slug'
import type { Enums, Tables } from '@/types/database'

export type Producto = Tables<'productos'>
export type Talla = Tables<'tallas'>
export type ImagenProducto = Tables<'imagenes_producto'>
export type GrupoTalla = Enums<'grupo_talla'>

export interface Opcion {
  id: string
  nombre: string
}

export type TablaOpciones = 'marcas' | 'categorias' | 'estilos'

export async function listarOpciones(tabla: TablaOpciones): Promise<Opcion[]> {
  const { data, error } = await supabase.from(tabla).select('id, nombre').order('nombre')
  if (error) throw error
  return data
}

export async function crearOpcion(tabla: TablaOpciones, nombre: string): Promise<Opcion> {
  const { data, error } = await supabase
    .from(tabla)
    .insert({ nombre: nombre.trim(), slug: slugify(nombre) })
    .select('id, nombre')
    .single()
  if (error) throw error
  return data
}

export async function listarTallas(): Promise<Talla[]> {
  const { data, error } = await supabase.from('tallas').select('id, grupo, etiqueta, orden').order('orden')
  if (error) throw error
  return data
}

export interface ProductoResumen {
  id: string
  nombre: string
  slug: string
  grupo: GrupoTalla
  precio_publico: number
  precio_mayorista: number | null
  activo: boolean
  destacado: boolean
  marca: string | null
  categoria: string | null
  stock_total: number
  imagen: string | null
}

export async function listarProductosAdmin(): Promise<ProductoResumen[]> {
  const [prods, may, vars, imgs] = await Promise.all([
    supabase.from('productos').select('id, nombre, slug, grupo, precio_publico, activo, destacado, marcas(nombre), categorias(nombre)').order('creado_en', { ascending: false }),
    supabase.from('precios_mayorista').select('producto_id, precio'),
    supabase.from('variantes_producto').select('producto_id, stock'),
    supabase.from('imagenes_producto').select('producto_id, url, orden').order('orden'),
  ])
  for (const r of [prods, may, vars, imgs]) if (r.error) throw r.error

  const precioMay = new Map((may.data ?? []).map((m) => [m.producto_id, m.precio]))
  const stock = new Map<string, number>()
  for (const v of vars.data ?? []) stock.set(v.producto_id, (stock.get(v.producto_id) ?? 0) + v.stock)
  const imagen = new Map<string, string>()
  for (const i of imgs.data ?? []) if (!imagen.has(i.producto_id)) imagen.set(i.producto_id, i.url)

  return (prods.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    slug: p.slug,
    grupo: p.grupo,
    precio_publico: p.precio_publico,
    precio_mayorista: precioMay.get(p.id) ?? null,
    activo: p.activo,
    destacado: p.destacado,
    marca: p.marcas?.nombre ?? null,
    categoria: p.categorias?.nombre ?? null,
    stock_total: stock.get(p.id) ?? 0,
    imagen: imagen.get(p.id) ?? null,
  }))
}

export const LOTE_ADMIN = 20

export interface PaginaProductosAdmin {
  productos: ProductoResumen[]
  total: number
}

/** Una página de la lista del admin (filtrada en el servidor), pidiendo solo las columnas que se muestran. */
export async function listarProductosAdminPagina(f: { q: string; grupo: string }, desde: number, limite = LOTE_ADMIN): Promise<PaginaProductosAdmin> {
  let consulta = supabase
    .from('productos')
    .select('id, nombre, slug, grupo, precio_publico, activo, destacado, marcas(nombre), categorias(nombre)', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .order('id')
    .range(desde, desde + limite - 1)
  if (f.grupo) consulta = consulta.eq('grupo', f.grupo as GrupoTalla)
  const texto = f.q.trim().replace(/[%_]/g, '')
  if (texto) consulta = consulta.ilike('nombre', `%${texto}%`)
  const prods = await consulta
  if (prods.error) throw prods.error
  const filas = prods.data ?? []
  if (filas.length === 0) return { productos: [], total: prods.count ?? 0 }

  const ids = filas.map((p) => p.id)
  const [may, vars, imgs] = await Promise.all([
    supabase.from('precios_mayorista').select('producto_id, precio').in('producto_id', ids),
    supabase.from('variantes_producto').select('producto_id, stock').in('producto_id', ids),
    supabase.from('imagenes_producto').select('producto_id, url, url_miniatura, orden').in('producto_id', ids).order('orden'),
  ])
  for (const r of [may, vars, imgs]) if (r.error) throw r.error

  const precioMay = new Map((may.data ?? []).map((m) => [m.producto_id, m.precio]))
  const stock = new Map<string, number>()
  for (const v of vars.data ?? []) stock.set(v.producto_id, (stock.get(v.producto_id) ?? 0) + v.stock)
  const imagen = new Map<string, string>()
  for (const i of imgs.data ?? []) if (!imagen.has(i.producto_id)) imagen.set(i.producto_id, i.url_miniatura ?? i.url)

  return {
    total: prods.count ?? filas.length,
    productos: filas.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      slug: p.slug,
      grupo: p.grupo,
      precio_publico: p.precio_publico,
      precio_mayorista: precioMay.get(p.id) ?? null,
      activo: p.activo,
      destacado: p.destacado,
      marca: p.marcas?.nombre ?? null,
      categoria: p.categorias?.nombre ?? null,
      stock_total: stock.get(p.id) ?? 0,
      imagen: imagen.get(p.id) ?? null,
    })),
  }
}

export interface ProductoDetalle extends Producto {
  precio_mayorista: number | null
}

export async function obtenerProducto(id: string): Promise<ProductoDetalle> {
  const [p, m] = await Promise.all([
    supabase.from('productos').select('*').eq('id', id).single(),
    supabase.from('precios_mayorista').select('precio').eq('producto_id', id).maybeSingle(),
  ])
  if (p.error) throw p.error
  if (m.error) throw m.error
  return { ...p.data, precio_mayorista: m.data?.precio ?? null }
}

export interface ProductoEntrada {
  nombre: string
  grupo: GrupoTalla
  marca_id: string | null
  categoria_id: string | null
  estilo_id: string | null
  descripcion: string | null
  precio_publico: number
  precio_mayorista: number | null
  activo: boolean
  destacado: boolean
}

async function guardarPrecioMayorista(productoId: string, precio: number | null) {
  if (precio === null) {
    const { error } = await supabase.from('precios_mayorista').delete().eq('producto_id', productoId)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('precios_mayorista').upsert({ producto_id: productoId, precio })
  if (error) throw error
}

export async function crearProducto(v: ProductoEntrada): Promise<string> {
  const { precio_mayorista, ...resto } = v
  const base = slugify(v.nombre) || 'producto'
  for (let intento = 0; intento < 4; intento++) {
    const slug = intento === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`
    const { data, error } = await supabase.from('productos').insert({ ...resto, slug }).select('id').single()
    if (!error) {
      await guardarPrecioMayorista(data.id, precio_mayorista)
      return data.id
    }
    if (error.code !== '23505') throw error
  }
  throw new Error('No se pudo generar un identificador único para el producto')
}

export async function actualizarProducto(id: string, v: ProductoEntrada): Promise<void> {
  const { precio_mayorista, ...resto } = v
  const { error } = await supabase.from('productos').update(resto).eq('id', id)
  if (error) throw error
  await guardarPrecioMayorista(id, precio_mayorista)
}

export async function actualizarPrecios(id: string, precioPublico: number, precioMayorista: number | null): Promise<void> {
  const { error } = await supabase.from('productos').update({ precio_publico: precioPublico }).eq('id', id)
  if (error) throw error
  await guardarPrecioMayorista(id, precioMayorista)
}

export async function eliminarProducto(id: string): Promise<void> {
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw error
}

// ---- Imágenes ----
export async function listarImagenes(productoId: string): Promise<ImagenProducto[]> {
  const { data, error } = await supabase
    .from('imagenes_producto')
    .select('id, producto_id, color, url, url_miniatura, orden')
    .eq('producto_id', productoId)
    .order('orden')
  if (error) throw error
  return data
}

/** Sube la foto grande y su miniatura (ya convertidas a WebP) y registra ambas. Se guardan con caché de un año. */
export async function subirImagen(productoId: string, color: string, img: ImagenOptimizada, orden: number): Promise<void> {
  const base = `${productoId}/${crypto.randomUUID()}`
  const rutaGrande = `${base}.${extensionDeTipo(img.principal.type)}`
  const rutaMini = `${base}-m.${extensionDeTipo(img.miniatura.type)}`
  const almacen = supabase.storage.from('productos')
  const opciones = (b: Blob) => ({ contentType: b.type, cacheControl: '31536000' })

  const g = await almacen.upload(rutaGrande, img.principal, opciones(img.principal))
  if (g.error) throw g.error
  const m = await almacen.upload(rutaMini, img.miniatura, opciones(img.miniatura))
  if (m.error) {
    await almacen.remove([rutaGrande])
    throw m.error
  }
  const { error } = await supabase.from('imagenes_producto').insert({
    producto_id: productoId,
    color: color.trim(),
    url: almacen.getPublicUrl(rutaGrande).data.publicUrl,
    url_miniatura: almacen.getPublicUrl(rutaMini).data.publicUrl,
    orden,
  })
  if (error) {
    await almacen.remove([rutaGrande, rutaMini])
    throw error
  }
}

function rutaEnAlmacen(url: string | null): string | null {
  const marca = '/object/public/productos/'
  const i = url ? url.indexOf(marca) : -1
  return url && i >= 0 ? url.slice(i + marca.length) : null
}

export async function eliminarImagen(imagen: ImagenProducto): Promise<void> {
  const { error } = await supabase.from('imagenes_producto').delete().eq('id', imagen.id)
  if (error) throw error
  const rutas = [rutaEnAlmacen(imagen.url), rutaEnAlmacen(imagen.url_miniatura)].filter((r): r is string => !!r)
  if (rutas.length > 0) await supabase.storage.from('productos').remove(rutas)
}

/** Intercambia el orden de dos imágenes. */
export async function intercambiarOrden(a: ImagenProducto, b: ImagenProducto): Promise<void> {
  const r1 = await supabase.from('imagenes_producto').update({ orden: b.orden }).eq('id', a.id)
  if (r1.error) throw r1.error
  const r2 = await supabase.from('imagenes_producto').update({ orden: a.orden }).eq('id', b.id)
  if (r2.error) throw r2.error
}

// ---- Variantes ----
export interface VarianteFila {
  id: string
  color: string
  talla: string
  tallaOrden: number
  sku: string
  stock: number
}

export async function listarVariantes(productoId: string): Promise<VarianteFila[]> {
  const { data, error } = await supabase
    .from('variantes_producto')
    .select('id, color, sku, stock, tallas(etiqueta, orden)')
    .eq('producto_id', productoId)
  if (error) throw error
  return data
    .map((v) => ({
      id: v.id,
      color: v.color,
      sku: v.sku,
      stock: v.stock,
      talla: v.tallas?.etiqueta ?? '',
      tallaOrden: v.tallas?.orden ?? 0,
    }))
    .sort((a, b) => a.color.localeCompare(b.color) || a.tallaOrden - b.tallaOrden)
}

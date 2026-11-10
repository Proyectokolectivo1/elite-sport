import { supabase } from '@/lib/supabase'
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
  const { data, error } = await supabase.from('tallas').select('*').order('orden')
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
    supabase.from('productos').select('*, marcas(nombre), categorias(nombre)').order('creado_en', { ascending: false }),
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
    .select('*')
    .eq('producto_id', productoId)
    .order('orden')
  if (error) throw error
  return data
}

export async function subirImagen(productoId: string, color: string, blob: Blob, orden: number): Promise<void> {
  const ruta = `${productoId}/${crypto.randomUUID()}.webp`
  const { error: errSubida } = await supabase.storage.from('productos').upload(ruta, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
  })
  if (errSubida) throw errSubida
  const { data } = supabase.storage.from('productos').getPublicUrl(ruta)
  const { error } = await supabase
    .from('imagenes_producto')
    .insert({ producto_id: productoId, color: color.trim(), url: data.publicUrl, orden })
  if (error) {
    await supabase.storage.from('productos').remove([ruta])
    throw error
  }
}

export async function eliminarImagen(imagen: ImagenProducto): Promise<void> {
  const { error } = await supabase.from('imagenes_producto').delete().eq('id', imagen.id)
  if (error) throw error
  const marca = '/object/public/productos/'
  const i = imagen.url.indexOf(marca)
  if (i >= 0) await supabase.storage.from('productos').remove([imagen.url.slice(i + marca.length)])
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

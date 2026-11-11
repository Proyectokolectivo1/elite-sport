import { supabase } from '@/lib/supabase'
import type { ConfigMoneda } from '@/lib/money'
import type { Tables } from '@/types/database'

export type Configuracion = Tables<'configuracion'>

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const { data, error } = await supabase.from('configuracion').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export type CamposFondo = 'fondo_activo' | 'fondo_video_url' | 'fondo_video_movil_url' | 'fondo_poster_url' | 'fondo_opacidad'
export type ConfiguracionEntrada = Omit<Configuracion, 'id' | 'actualizado_en' | CamposFondo>
export type FondoEntrada = Partial<Pick<Configuracion, CamposFondo>>

export async function actualizarConfiguracion(v: ConfiguracionEntrada): Promise<void> {
  const { error } = await supabase.from('configuracion').update({ ...v, actualizado_en: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
}

export function aConfigMoneda(c: Configuracion): ConfigMoneda {
  return {
    moneda_codigo: c.moneda_codigo,
    moneda_simbolo: c.moneda_simbolo,
    moneda_decimales: c.moneda_decimales,
    locale: c.locale,
  }
}

export async function actualizarFondo(v: FondoEntrada): Promise<void> {
  const { error } = await supabase.from('configuracion').update({ ...v, actualizado_en: new Date().toISOString() }).eq('id', 1)
  if (error) throw error
}

export type MedioFondo = 'video' | 'video-movil' | 'poster'

const MIME: Record<MedioFondo, string[]> = {
  video: ['video/mp4', 'video/webm'],
  'video-movil': ['video/mp4', 'video/webm'],
  poster: ['image/jpeg', 'image/png', 'image/webp'],
}
const MAX_MB = 25

/** Sube un medio al bucket `medios` y devuelve su URL pública. */
export async function subirMedioFondo(tipo: MedioFondo, archivo: File | Blob): Promise<string> {
  if (!MIME[tipo].includes(archivo.type)) throw new Error(tipo === 'poster' ? 'La imagen debe ser JPG, PNG o WebP.' : 'El video debe ser MP4 o WebM.')
  if (archivo.size > MAX_MB * 1024 * 1024) throw new Error(`El archivo pesa más de ${MAX_MB} MB.`)
  const ext = archivo.type === 'image/jpeg' ? 'jpg' : archivo.type.split('/')[1]
  const ruta = `fondo/${tipo}-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('medios').upload(ruta, archivo, { contentType: archivo.type, cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('medios').getPublicUrl(ruta).data.publicUrl
}

/** Borra un medio anterior; no falla si ya no existe. */
export async function borrarMedioFondo(url: string | null): Promise<void> {
  const marca = '/object/public/medios/'
  const i = url ? url.indexOf(marca) : -1
  if (url && i >= 0) await supabase.storage.from('medios').remove([url.slice(i + marca.length)])
}

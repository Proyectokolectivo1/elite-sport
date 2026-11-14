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
/** Topes por archivo: cada visitante nuevo descarga el medio, y el plan gratuito de Supabase incluye 5 GB al mes. */
const MAX_MB: Record<MedioFondo, number> = { video: 4, 'video-movil': 2, poster: 0.3 }

/** Sube un medio al bucket `medios` y devuelve su URL pública. */
export async function subirMedioFondo(tipo: MedioFondo, archivo: File | Blob): Promise<string> {
  if (!MIME[tipo].includes(archivo.type)) throw new Error(tipo === 'poster' ? 'La imagen debe ser JPG, PNG o WebP.' : 'El video debe ser MP4 o WebM.')
  const tope = MAX_MB[tipo]
  if (archivo.size > tope * 1024 * 1024) throw new Error(`El archivo pesa más de ${tope < 1 ? `${tope * 1000} KB` : `${tope} MB`}. Comprímelo antes de subirlo.`)
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

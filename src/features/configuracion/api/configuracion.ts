import { supabase } from '@/lib/supabase'
import type { ConfigMoneda } from '@/lib/money'
import type { Tables } from '@/types/database'

export type Configuracion = Tables<'configuracion'>

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const { data, error } = await supabase.from('configuracion').select('*').eq('id', 1).single()
  if (error) throw error
  return data
}

export type ConfiguracionEntrada = Omit<Configuracion, 'id' | 'actualizado_en'>

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

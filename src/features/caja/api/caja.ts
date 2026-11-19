import { supabase } from '@/lib/supabase'
import { resumenVentasSchema, type FilaVentas } from '../schemas'

/** Ventas del periodo por canal. Solo el admin puede pedirlo. */
export async function resumenVentas(desde: Date, hasta: Date): Promise<FilaVentas[]> {
  const { data, error } = await supabase.rpc('resumen_ventas', { p_desde: desde.toISOString(), p_hasta: hasta.toISOString() })
  if (error) throw error
  return resumenVentasSchema.parse(data).filas
}

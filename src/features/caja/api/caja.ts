import { supabase } from '@/lib/supabase'
import { resumenVentasSchema, type ResumenVentas } from '../schemas'

/** Ventas del periodo por canal. Solo el admin puede pedirlo. */
export async function resumenVentas(desde: Date, hasta: Date): Promise<ResumenVentas> {
  const { data, error } = await supabase.rpc('resumen_ventas', { p_desde: desde.toISOString(), p_hasta: hasta.toISOString() })
  if (error) throw error
  const r = resumenVentasSchema.parse(data)
  return { filas: r.filas, porCerrar: r.por_cerrar }
}

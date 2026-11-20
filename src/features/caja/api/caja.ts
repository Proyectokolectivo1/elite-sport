import { supabase } from '@/lib/supabase'
import { reporteLocalesSchema, type VentaLocal } from '../reporteLocales'
import { resumenVentasSchema, type ResumenVentas } from '../schemas'

/** Ventas del periodo por canal. Solo el admin puede pedirlo. */
export async function resumenVentas(desde: Date, hasta: Date): Promise<ResumenVentas> {
  const { data, error } = await supabase.rpc('resumen_ventas', { p_desde: desde.toISOString(), p_hasta: hasta.toISOString() })
  if (error) throw error
  const r = resumenVentasSchema.parse(data)
  return { filas: r.filas, porCerrar: r.por_cerrar }
}

/** Ventas cerradas del local en el periodo, con su local, vendedor y líneas. Solo el admin. */
export async function reporteVentasLocales(desde: Date, hasta: Date): Promise<VentaLocal[]> {
  const { data, error } = await supabase.rpc('reporte_ventas_locales', { p_desde: desde.toISOString(), p_hasta: hasta.toISOString() })
  if (error) throw error
  return reporteLocalesSchema.parse(data)
}

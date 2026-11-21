import { supabase } from '@/lib/supabase'
import { listaExhibicionSchema, listaPiezaVendedorSchema, type AltaExhibicionValues, type FilaExhibicion } from '../schemas'

export async function listarExhibiciones() {
  const { data, error } = await supabase.rpc('listar_exhibiciones')
  if (error) throw error
  return listaExhibicionSchema.parse(data)
}

/** Piezas disponibles para el vendedor: dónde están, sin stock. */
export async function exhibicionesParaVendedor() {
  const { data, error } = await supabase.rpc('exhibiciones_para_vendedor')
  if (error) throw error
  return listaPiezaVendedorSchema.parse(data)
}

export async function registrarExhibicion(v: AltaExhibicionValues): Promise<void> {
  const { error } = await supabase.rpc('registrar_exhibicion', { p_variante: v.varianteId, p_local: v.localId, p_pieza: v.pieza })
  if (error) throw error
}

export async function quitarExhibicion(id: string): Promise<void> {
  const { error } = await supabase.rpc('quitar_exhibicion', { p_id: id })
  if (error) throw error
}

/** Al crear un producto: crea la talla y suma al stock los pares de exhibición, y marca el local de cada pieza. Solo admin. */
export async function registrarExhibicionProducto(productoId: string, filas: FilaExhibicion[]): Promise<void> {
  const { error } = await supabase.rpc('registrar_exhibicion_producto', {
    p_producto: productoId,
    p_piezas: filas.map((f) => ({ color: f.color.trim(), talla: f.talla, pieza: f.pieza, local_id: f.localId })),
  })
  if (error) throw error
}

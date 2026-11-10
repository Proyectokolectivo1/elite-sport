import { supabase } from '@/lib/supabase'

export interface ResumenAdmin {
  pedidosNuevos: number
  mayoristasPendientes: number
  stockBajo: number
  agotadas: number
  productosActivos: number
}

async function contar(q: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function obtenerResumen(): Promise<ResumenAdmin> {
  const [pedidosNuevos, mayoristasPendientes, stockBajo, agotadas, productosActivos] = await Promise.all([
    contar(supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo')),
    contar(supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'mayorista').eq('estado', 'pendiente')),
    contar(supabase.from('variantes_producto').select('id', { count: 'exact', head: true }).gt('stock', 0).lte('stock', 3)),
    contar(supabase.from('variantes_producto').select('id', { count: 'exact', head: true }).eq('stock', 0)),
    contar(supabase.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true)),
  ])
  return { pedidosNuevos, mayoristasPendientes, stockBajo, agotadas, productosActivos }
}

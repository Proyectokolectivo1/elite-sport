import { supabase } from '@/lib/supabase'

export interface Pendientes {
  /** Pedidos web (minorista, mayorista, tienda de mayorista) por atender. */
  pedidos: number
  /** Pedidos a bodega sin despachar. */
  bodega: number
  /** Pedidos web confirmados por entregar. */
  web: number
  /** Mayoristas que esperan aprobacion. */
  mayoristas: number
}

async function contar(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

/** Admin: solo conteos (HEAD), sin traer filas. */
export async function pendientesAdmin(): Promise<Pendientes> {
  const [pedidos, bodega, mayoristas] = await Promise.all([
    contar(supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo').in('tipo', ['minorista', 'mayorista', 'lead_tienda'])),
    contar(supabase.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'nuevo').eq('tipo', 'consignacion')),
    contar(supabase.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'mayorista').eq('estado', 'pendiente')),
  ])
  return { pedidos, bodega, web: 0, mayoristas }
}

/** Bodeguero: la funcion devuelve solo tres numeros (no lee pedidos ni precios). */
export async function pendientesBodeguero(): Promise<Pendientes> {
  const { data, error } = await supabase.rpc('contar_pendientes_bodega')
  if (error) throw error
  const d = data as { por_despachar?: number; web?: number }
  return { pedidos: 0, bodega: Number(d.por_despachar ?? 0), web: Number(d.web ?? 0), mayoristas: 0 }
}

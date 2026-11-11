import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { buscarProductos, obtenerProductoPorSlug, type FiltrosBusqueda } from '../api/tienda'

/** Productos que se piden por lote al hacer scroll. */
export const LOTE_CATALOGO = 12

export function useProductosInfinitos(tiendaId: string | null, filtros: FiltrosBusqueda) {
  return useInfiniteQuery({
    queryKey: ['productos-lotes', tiendaId, filtros],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => buscarProductos(tiendaId, filtros, LOTE_CATALOGO, pageParam),
    getNextPageParam: (ultima, paginas) => {
      const cargados = paginas.reduce((s, p) => s + p.productos.length, 0)
      return cargados < ultima.total && ultima.productos.length > 0 ? cargados : undefined
    },
    staleTime: 60_000,
    enabled: tiendaId !== undefined,
  })
}

/** Una sola página corta (inicio: destacados y novedades; ficha: relacionados). */
export function useProductosPagina(clave: string, tiendaId: string | null, filtros: FiltrosBusqueda, limite: number, habilitado = true) {
  return useQuery({
    queryKey: ['productos-pagina', clave, tiendaId, filtros, limite],
    queryFn: () => buscarProductos(tiendaId, filtros, limite, 0),
    staleTime: 60_000,
    enabled: habilitado,
  })
}

export function useProductoPorSlug(slug: string | undefined, tiendaId: string | null) {
  return useQuery({
    queryKey: ['producto-slug', slug, tiendaId],
    queryFn: () => obtenerProductoPorSlug(slug as string, tiendaId),
    enabled: !!slug,
    staleTime: 60_000,
  })
}

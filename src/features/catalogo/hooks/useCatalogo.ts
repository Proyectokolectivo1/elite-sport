import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ImagenOptimizada } from '@/lib/imagen'
import {
  actualizarPrecios,
  actualizarProducto,
  crearOpcion,
  crearProducto,
  eliminarImagen,
  eliminarProducto,
  intercambiarOrden,
  listarImagenes,
  listarOpciones,
  listarProductosAdmin,
  listarProductosAdminPagina,
  listarTallas,
  listarVariantes,
  obtenerProducto,
  subirImagen,
  type ImagenProducto,
  type ProductoEntrada,
  type TablaOpciones,
} from '../api/catalogo'

export const catalogoKeys = {
  productos: ['productos'] as const,
  producto: (id: string) => ['producto', id] as const,
  imagenes: (id: string) => ['imagenes', id] as const,
  variantes: (id: string) => ['variantes', id] as const,
  opciones: (t: TablaOpciones) => ['opciones', t] as const,
  tallas: ['tallas'] as const,
}

export const useProductos = () => useQuery({ queryKey: catalogoKeys.productos, queryFn: listarProductosAdmin })
/** Lista del admin por lotes (scroll infinito). */
export const useProductosPaginados = (f: { q: string; grupo: string }) =>
  useInfiniteQuery({
    queryKey: ['productos-admin', f],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listarProductosAdminPagina(f, pageParam),
    getNextPageParam: (ultima, paginas) => {
      const cargados = paginas.reduce((s, p) => s + p.productos.length, 0)
      return cargados < ultima.total && ultima.productos.length > 0 ? cargados : undefined
    },
  })
export const useProducto = (id: string | undefined) =>
  useQuery({ queryKey: catalogoKeys.producto(id ?? ''), queryFn: () => obtenerProducto(id as string), enabled: !!id })
export const useImagenes = (id: string) => useQuery({ queryKey: catalogoKeys.imagenes(id), queryFn: () => listarImagenes(id) })
export const useVariantes = (id: string) => useQuery({ queryKey: catalogoKeys.variantes(id), queryFn: () => listarVariantes(id), enabled: !!id })
export const useOpciones = (t: TablaOpciones) => useQuery({ queryKey: catalogoKeys.opciones(t), queryFn: () => listarOpciones(t), staleTime: 60_000 })
export const useTallas = () => useQuery({ queryKey: catalogoKeys.tallas, queryFn: listarTallas, staleTime: 10 * 60_000 })

export function useCrearOpcion(tabla: TablaOpciones) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nombre: string) => crearOpcion(tabla, nombre),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogoKeys.opciones(tabla) }),
  })
}

export function useGuardarProducto(id?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: ProductoEntrada) => {
      if (id) {
        await actualizarProducto(id, v)
        return id
      }
      return crearProducto(v)
    },
    onSuccess: (productoId) => {
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
      void qc.invalidateQueries({ queryKey: ['productos-admin'] })
      void qc.invalidateQueries({ queryKey: catalogoKeys.producto(productoId) })
    },
  })
}

export function useEliminarProducto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: eliminarProducto,
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogoKeys.productos }),
  })
}

export function useActualizarPrecios() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; publico: number; mayorista: number | null }) => actualizarPrecios(v.id, v.publico, v.mayorista),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogoKeys.productos }),
  })
}

export function useSubirImagenes(productoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { color: string; imagenes: ImagenOptimizada[]; ordenInicial: number }) => {
      for (let i = 0; i < v.imagenes.length; i++) await subirImagen(productoId, v.color, v.imagenes[i], v.ordenInicial + i)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: catalogoKeys.imagenes(productoId) })
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
    },
  })
}

export function useEliminarImagen(productoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (img: ImagenProducto) => eliminarImagen(img),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogoKeys.imagenes(productoId) }),
  })
}

export function useIntercambiarOrden(productoId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { a: ImagenProducto; b: ImagenProducto }) => intercambiarOrden(v.a, v.b),
    onSuccess: () => qc.invalidateQueries({ queryKey: catalogoKeys.imagenes(productoId) }),
  })
}

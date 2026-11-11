import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { listarPedidos } from '@/features/pedidos/api/pedidos'
import {
  actualizarEstadoPedidoCliente,
  actualizarMiTienda,
  cancelarMiPedido,
  crearPedidoMayorista,
  guardarPreciosTienda,
  listarCostos,
  listarPreciosTienda,
  obtenerMiPlazo,
  obtenerMiTienda,
  quitarImagenTienda,
  subirImagenTienda,
  type CambioPrecio,
  type MiTiendaEntrada,
} from '../api/mayorista'

export function useMiTienda() {
  const { session } = useAuth()
  const id = session?.user.id
  return useQuery({ queryKey: ['mi-tienda', id], queryFn: () => obtenerMiTienda(id as string), enabled: !!id })
}

export function useCostos() {
  const { session } = useAuth()
  const id = session?.user.id
  return useQuery({ queryKey: ['mis-costos', id], queryFn: () => listarCostos(id as string), enabled: !!id })
}

export function usePreciosMiTienda(tiendaId: string | undefined) {
  return useQuery({ queryKey: ['mis-precios', tiendaId], queryFn: () => listarPreciosTienda(tiendaId as string), enabled: !!tiendaId })
}

/** Pedidos visibles para el mayorista (RLS): sus compras al admin y los leads de su tienda. */
export function useMisPedidos() {
  // Se refresca cada medio minuto para que los pedidos nuevos de sus clientes aparezcan sin recargar.
  return useQuery({ queryKey: ['mis-pedidos'], queryFn: listarPedidos, refetchInterval: 30_000 })
}

export function useActualizarMiTienda(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: MiTiendaEntrada) => actualizarMiTienda(id, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mi-tienda'] }),
  })
}

export function useImagenTienda(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { tipo: 'logo' | 'banner'; blob: Blob | null }) => (v.blob ? subirImagenTienda(id, v.tipo, v.blob) : quitarImagenTienda(id, v.tipo)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mi-tienda'] }),
  })
}

export function useGuardarPrecios(tiendaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (cambios: CambioPrecio[]) => guardarPreciosTienda(tiendaId, cambios),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-precios', tiendaId] }),
  })
}

export function useCrearPedidoMayorista() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: crearPedidoMayorista,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mis-pedidos'] })
      void qc.invalidateQueries({ queryKey: ['catalogo-publico'] })
    },
  })
}

export function useCancelarMiPedido() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: cancelarMiPedido, onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-pedidos'] }) })
}

export function useMiPlazo() {
  const { session } = useAuth()
  const id = session?.user.id
  return useQuery({ queryKey: ['mi-plazo', id], queryFn: obtenerMiPlazo, enabled: !!id })
}

export function useActualizarPedidoCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; estado: 'confirmado' | 'entregado' | 'cancelado' }) => actualizarEstadoPedidoCliente(v.id, v.estado),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mis-pedidos'] }),
  })
}

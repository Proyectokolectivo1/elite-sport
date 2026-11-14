import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import { inventarioKeys } from '@/features/inventario/hooks/useInventario'
import { pedidosKey } from '@/features/pedidos/hooks/usePedidos'
import {
  actualizarIntegrante,
  cancelarPedidoBodega,
  cerrarEntrega,
  despacharPedido,
  entregarPedidoWeb,
  listarEquipo,
  listarPedidosBodega,
  misEntregas,
  misParesEnPoder,
  misVentasLocal,
  recibirDevolucion,
  registrarVentaLocal,
  solicitarABodega,
  type VistaBodega,
} from '../api/bodega'
import type { IntegranteValues } from '../schemas'

export const bodegaKeys = {
  todo: ['bodega'] as const,
  vista: (v: VistaBodega) => ['bodega', 'vista', v] as const,
  enPoder: (uid: string | undefined) => ['bodega', 'en-poder', uid] as const,
  entregas: (uid: string | undefined) => ['bodega', 'entregas', uid] as const,
  ventas: (uid: string | undefined) => ['bodega', 'ventas', uid] as const,
  equipo: ['equipo'] as const,
}

/** Refresca todo lo que cambia con un movimiento de bodega. */
function useRefrescar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: bodegaKeys.todo })
    void qc.invalidateQueries({ queryKey: pedidosKey })
    void qc.invalidateQueries({ queryKey: inventarioKeys.existencias })
    void qc.invalidateQueries({ queryKey: inventarioKeys.movimientos })
    void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
    void qc.invalidateQueries({ queryKey: ['catalogo-publico'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export const usePedidosBodega = (vista: VistaBodega) =>
  useQuery({ queryKey: bodegaKeys.vista(vista), queryFn: () => listarPedidosBodega(vista), refetchInterval: 30_000 })

export function useDespachar() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (v: { id: string; lineas: { detalleId: string; entregados: number }[] }) => despacharPedido(v.id, v.lineas),
    onSuccess: refrescar,
  })
}

export function useDevolucion() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (v: { id: string; lineas: { detalleId: string; devueltos: number }[] }) => recibirDevolucion(v.id, v.lineas),
    onSuccess: refrescar,
  })
}

export function useCerrarEntrega() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (v: { id: string; lineas: { detalleId: string; vendidos: number; devueltos: number }[] }) => cerrarEntrega(v.id, v.lineas),
    onSuccess: refrescar,
  })
}

export function useEntregarWeb() {
  const refrescar = useRefrescar()
  return useMutation({ mutationFn: entregarPedidoWeb, onSuccess: refrescar })
}

export function useCancelarPedidoBodega() {
  const refrescar = useRefrescar()
  return useMutation({ mutationFn: cancelarPedidoBodega, onSuccess: refrescar })
}

export function useSolicitarABodega() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (v: { items: { varianteId: string; cantidad: number }[]; nota: string }) => solicitarABodega(v.items, v.nota),
    onSuccess: refrescar,
  })
}

export function useMisParesEnPoder() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({ queryKey: bodegaKeys.enPoder(uid), queryFn: misParesEnPoder, enabled: !!uid, refetchInterval: 30_000 })
}

export function useMisEntregas() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({ queryKey: bodegaKeys.entregas(uid), queryFn: () => misEntregas(uid as string), enabled: !!uid, refetchInterval: 30_000 })
}

/** Ventas del vendedor desde el inicio del día. */
export function useMisVentasHoy() {
  const { session } = useAuth()
  const uid = session?.user.id
  return useQuery({
    queryKey: bodegaKeys.ventas(uid),
    queryFn: () => {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      return misVentasLocal(uid as string, hoy)
    },
    enabled: !!uid,
  })
}

export function useRegistrarVentaLocal() {
  const refrescar = useRefrescar()
  return useMutation({ mutationFn: registrarVentaLocal, onSuccess: refrescar })
}

export const useEquipo = () => useQuery({ queryKey: bodegaKeys.equipo, queryFn: listarEquipo })

export function useActualizarIntegrante() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; valores: IntegranteValues }) => actualizarIntegrante(v.id, v.valores),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: bodegaKeys.equipo })
      void qc.invalidateQueries({ queryKey: ['mayoristas'] })
    },
  })
}

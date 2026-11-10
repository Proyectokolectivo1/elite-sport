import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import { inventarioKeys } from '@/features/inventario/hooks/useInventario'
import { ejecutarAccionPedido, listarDetallePedido, listarPedidos, type AccionPedido } from '../api/pedidos'

export const pedidosKey = ['pedidos'] as const

export const usePedidos = () => useQuery({ queryKey: pedidosKey, queryFn: listarPedidos })
export const useDetallePedido = (id: string | null) =>
  useQuery({ queryKey: ['pedido-detalle', id], queryFn: () => listarDetallePedido(id as string), enabled: !!id })

export function useAccionPedido() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { accion: AccionPedido; id: string }) => ejecutarAccionPedido(v.accion, v.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pedidosKey })
      void qc.invalidateQueries({ queryKey: inventarioKeys.existencias })
      void qc.invalidateQueries({ queryKey: inventarioKeys.movimientos })
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

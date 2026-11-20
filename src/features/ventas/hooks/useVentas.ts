import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import { inventarioKeys } from '@/features/inventario/hooks/useInventario'
import { pedidosKey } from '@/features/pedidos/hooks/usePedidos'
import { cajaKey } from '@/features/caja/hooks/useCaja'
import { anularVentaLocal, cerrarVentaLocal, listarVentasPorCerrar, registrarVentaMostrador } from '../api/ventas'

export function useRegistrarVenta() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: registrarVentaMostrador,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: pedidosKey })
      void qc.invalidateQueries({ queryKey: inventarioKeys.existencias })
      void qc.invalidateQueries({ queryKey: inventarioKeys.movimientos })
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
      void qc.invalidateQueries({ queryKey: ['catalogo-publico'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export const porCerrarKey = ['ventas-por-cerrar'] as const

export const useVentasPorCerrar = () => useQuery({ queryKey: porCerrarKey, queryFn: listarVentasPorCerrar, refetchInterval: 30_000 })

function useInvalidarCierre() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: porCerrarKey })
    void qc.invalidateQueries({ queryKey: cajaKey })
    void qc.invalidateQueries({ queryKey: pedidosKey })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useCerrarVentaLocal() {
  const invalidar = useInvalidarCierre()
  return useMutation({ mutationFn: cerrarVentaLocal, onSuccess: invalidar })
}

export function useAnularVentaLocal() {
  const invalidar = useInvalidarCierre()
  return useMutation({ mutationFn: anularVentaLocal, onSuccess: invalidar })
}

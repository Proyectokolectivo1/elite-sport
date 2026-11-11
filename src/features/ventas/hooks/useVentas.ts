import { useMutation, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import { inventarioKeys } from '@/features/inventario/hooks/useInventario'
import { pedidosKey } from '@/features/pedidos/hooks/usePedidos'
import { registrarVentaMostrador } from '../api/ventas'

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

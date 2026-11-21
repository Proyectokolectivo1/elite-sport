import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import { inventarioKeys } from '@/features/inventario/hooks/useInventario'
import { exhibicionesParaVendedor, listarExhibiciones, quitarExhibicion, registrarExhibicion, registrarExhibicionProducto } from '../api/exhibicion'

export const exhibicionKeys = { todas: ['exhibiciones'] as const, vendedor: ['exhibiciones-vendedor'] as const }

export const useExhibiciones = (activo = true) => useQuery({ queryKey: exhibicionKeys.todas, queryFn: listarExhibiciones, enabled: activo })
export const useExhibicionesVendedor = (activo = true) => useQuery({ queryKey: exhibicionKeys.vendedor, queryFn: exhibicionesParaVendedor, enabled: activo })

function useRefrescar() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: exhibicionKeys.todas })
    void qc.invalidateQueries({ queryKey: exhibicionKeys.vendedor })
  }
}

export function useRegistrarExhibicion() {
  const refrescar = useRefrescar()
  return useMutation({ mutationFn: registrarExhibicion, onSuccess: refrescar })
}

export function useQuitarExhibicion() {
  const refrescar = useRefrescar()
  return useMutation({ mutationFn: quitarExhibicion, onSuccess: refrescar })
}

export function useRegistrarExhibicionProducto() {
  const qc = useQueryClient()
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: ({ productoId, filas }: { productoId: string; filas: Parameters<typeof registrarExhibicionProducto>[1] }) => registrarExhibicionProducto(productoId, filas),
    onSuccess: () => {
      refrescar()
      void qc.invalidateQueries({ queryKey: inventarioKeys.existencias })
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
      void qc.invalidateQueries({ queryKey: ['variantes'] })
    },
  })
}

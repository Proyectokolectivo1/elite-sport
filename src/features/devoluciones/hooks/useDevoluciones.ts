import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import { cajaKey } from '@/features/caja/hooks/useCaja'
import { inventarioKeys } from '@/features/inventario/hooks/useInventario'
import { listarDevoluciones, pedidosDevolvibles, registrarDevolucion } from '../api/devoluciones'
import type { DevolucionValues } from '../schemas'

export const devolucionesKey = ['devoluciones'] as const

export const usePedidosDevolvibles = () => useQuery({ queryKey: [...devolucionesKey, 'pedidos'], queryFn: pedidosDevolvibles })
export const useDevoluciones = () => useQuery({ queryKey: [...devolucionesKey, 'lista'], queryFn: listarDevoluciones })

export function useRegistrarDevolucion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { pedidoId: string; lineas: { detalleId: string; cantidad: number }[]; datos: DevolucionValues }) =>
      registrarDevolucion(v.pedidoId, v.lineas, v.datos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: devolucionesKey })
      void qc.invalidateQueries({ queryKey: inventarioKeys.existencias })
      void qc.invalidateQueries({ queryKey: inventarioKeys.movimientos })
      void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
      void qc.invalidateQueries({ queryKey: ['catalogo-publico'] })
      void qc.invalidateQueries({ queryKey: cajaKey })
    },
  })
}

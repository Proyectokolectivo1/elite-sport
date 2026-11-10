import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { catalogoKeys } from '@/features/catalogo/hooks/useCatalogo'
import {
  ajustarStock,
  crearCurva,
  eliminarCurva,
  listarCurvas,
  listarExistencias,
  listarMovimientos,
  registrarIngreso,
  type IngresoEntrada,
} from '../api/inventario'

export const inventarioKeys = {
  curvas: ['curvas'] as const,
  existencias: ['existencias'] as const,
  movimientos: ['movimientos'] as const,
}

export const useCurvas = () => useQuery({ queryKey: inventarioKeys.curvas, queryFn: listarCurvas })
export const useExistencias = () => useQuery({ queryKey: inventarioKeys.existencias, queryFn: listarExistencias })
export const useMovimientos = () => useQuery({ queryKey: inventarioKeys.movimientos, queryFn: () => listarMovimientos() })

function useRefrescarStock() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: inventarioKeys.existencias })
    void qc.invalidateQueries({ queryKey: inventarioKeys.movimientos })
    void qc.invalidateQueries({ queryKey: catalogoKeys.productos })
    void qc.invalidateQueries({ queryKey: ['variantes'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useRegistrarIngreso() {
  const refrescar = useRefrescarStock()
  return useMutation({ mutationFn: (v: IngresoEntrada) => registrarIngreso(v), onSuccess: refrescar })
}

export function useAjustarStock() {
  const refrescar = useRefrescarStock()
  return useMutation({
    mutationFn: (v: { varianteId: string; delta: number; nota: string }) => ajustarStock(v.varianteId, v.delta, v.nota),
    onSuccess: refrescar,
  })
}

export function useCrearCurva() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: Parameters<typeof crearCurva>) => crearCurva(...v),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventarioKeys.curvas }),
  })
}

export function useEliminarCurva() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: eliminarCurva, onSuccess: () => qc.invalidateQueries({ queryKey: inventarioKeys.curvas }) })
}

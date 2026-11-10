import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cambiarEstadoMayorista,
  guardarEspecial,
  listarEspeciales,
  listarMayoristas,
  type EspecialEntrada,
  type EstadoPerfil,
} from '../api/mayoristas'

export const mayoristasKey = ['mayoristas'] as const

export const useMayoristas = () => useQuery({ queryKey: mayoristasKey, queryFn: listarMayoristas })
export const useEspeciales = (mayoristaId: string) =>
  useQuery({ queryKey: ['especiales', mayoristaId], queryFn: () => listarEspeciales(mayoristaId), enabled: !!mayoristaId })

export function useCambiarEstado() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; estado: EstadoPerfil }) => cambiarEstadoMayorista(v.id, v.estado),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: mayoristasKey })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useGuardarEspecial(mayoristaId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { productoId: string; valor: EspecialEntrada }) => guardarEspecial(v.productoId, mayoristaId, v.valor),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['especiales', mayoristaId] }),
  })
}

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { escucharCambiosPedidos } from './api'

/** Consultas que dependen de los pedidos: se refrescan apenas llega un aviso. */
const CLAVES = new Set(['bodega', 'avisos', 'pedidos', 'ventas-por-cerrar', 'caja', 'dashboard', 'mis-pedidos'])

/** Mantiene al día las listas de pedidos sin recargar la página. Agrupa los avisos que llegan juntos. */
export function usePedidosEnVivo(activo: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!activo) return
    let espera: ReturnType<typeof setTimeout> | undefined
    const refrescar = () => {
      clearTimeout(espera)
      espera = setTimeout(() => {
        void qc.invalidateQueries({ predicate: (q) => CLAVES.has(String(q.queryKey[0])) })
      }, 300)
    }
    const dejar = escucharCambiosPedidos(refrescar)
    return () => {
      clearTimeout(espera)
      dejar()
    }
  }, [activo, qc])
}

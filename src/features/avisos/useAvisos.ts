import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pendientesAdmin, pendientesBodeguero, type Pendientes } from './api'
import { sonarAviso } from './sonido'
import type { Rol } from '@/features/auth/roles'

const VACIO: Pendientes = { pedidos: 0, bodega: 0, web: 0, mayoristas: 0 }
const TITULO_BASE = 'Elite Sport'

/**
 * Avisos de lo que llega: insignia en el menu, contador en el titulo de la pestana y una alerta sonora fuerte.
 * Consulta cada 30 s (solo conteos) y tambien con la pestana en segundo plano.
 * Si la funcion de conteo falla (por ejemplo, aun no esta instalada), no se muestra nada.
 */
export function useAvisos(rol: Rol | undefined): { pendientes: Pendientes; total: number } {
  const activo = rol === 'admin' || rol === 'bodeguero' || rol === 'auxiliar_bodega'
  const { data } = useQuery({
    queryKey: ['avisos', rol],
    queryFn: rol === 'admin' ? pendientesAdmin : pendientesBodeguero,
    enabled: activo,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false,
  })
  const pendientes = data ?? VACIO
  const total = pendientes.pedidos + pendientes.bodega + pendientes.web + pendientes.mayoristas

  // Suena solo cuando aparece algo nuevo, no al abrir la pagina.
  const anterior = useRef<number | null>(null)
  useEffect(() => {
    if (!data) return
    if (anterior.current !== null && total > anterior.current) sonarAviso()
    anterior.current = total
  }, [data, total])

  useEffect(() => {
    if (!activo) return
    document.title = total > 0 ? `(${total}) ${TITULO_BASE}` : TITULO_BASE
    return () => {
      document.title = TITULO_BASE
    }
  }, [activo, total])

  return { pendientes, total }
}

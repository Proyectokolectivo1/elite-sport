import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMoneyStore } from '@/lib/money'
import { aConfigMoneda, obtenerConfiguracion } from '../api/configuracion'

export const configuracionKey = ['configuracion'] as const

/** Carga `configuracion` y sincroniza la moneda que usa `formatMoney`. */
export function useConfiguracion() {
  const query = useQuery({ queryKey: configuracionKey, queryFn: obtenerConfiguracion, staleTime: 5 * 60_000 })
  const setConfig = useMoneyStore((s) => s.setConfig)

  useEffect(() => {
    if (query.data) setConfig(aConfigMoneda(query.data))
  }, [query.data, setConfig])

  return query
}

import { useQuery } from '@tanstack/react-query'
import { reporteVentasLocales, resumenVentas } from '../api/caja'

export const cajaKey = ['caja'] as const

export const useResumenVentas = (desde: Date | null, hasta: Date | null) =>
  useQuery({
    queryKey: [...cajaKey, desde?.toISOString(), hasta?.toISOString()],
    queryFn: () => resumenVentas(desde as Date, hasta as Date),
    enabled: !!desde && !!hasta,
    refetchInterval: 60_000,
  })

export const useReporteLocales = (desde: Date | null, hasta: Date | null) =>
  useQuery({
    queryKey: [...cajaKey, 'locales', desde?.toISOString(), hasta?.toISOString()],
    queryFn: () => reporteVentasLocales(desde as Date, hasta as Date),
    enabled: !!desde && !!hasta,
    refetchInterval: 60_000,
  })

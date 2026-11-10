import { create } from 'zustand'

export interface ConfigMoneda {
  moneda_codigo: string
  moneda_simbolo: string
  moneda_decimales: number
  locale: string
}

export const MONEDA_POR_DEFECTO: ConfigMoneda = {
  moneda_codigo: 'USD',
  moneda_simbolo: '$',
  moneda_decimales: 2,
  locale: 'es-EC',
}

interface MoneyState {
  config: ConfigMoneda
  setConfig: (config: ConfigMoneda) => void
}

/** Moneda activa. La alimenta `useConfiguracion` a partir de la tabla `configuracion`. */
export const useMoneyStore = create<MoneyState>((set) => ({
  config: MONEDA_POR_DEFECTO,
  setConfig: (config) => set({ config }),
}))

/** Da formato a un monto según la moneda configurada por el admin. Nunca hardcodees "$". */
export function formatMoney(amount: number, config: ConfigMoneda = useMoneyStore.getState().config): string {
  const { moneda_codigo, moneda_decimales, locale, moneda_simbolo } = config
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: moneda_codigo,
      minimumFractionDigits: moneda_decimales,
      maximumFractionDigits: moneda_decimales,
    }).format(amount)
  } catch {
    return `${moneda_simbolo}${amount.toFixed(moneda_decimales)}`
  }
}

/** Hook reactivo: re-renderiza si el admin cambia la moneda. */
export function useFormatMoney(): (amount: number) => string {
  const config = useMoneyStore((s) => s.config)
  return (amount) => formatMoney(amount, config)
}

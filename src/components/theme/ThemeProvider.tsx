import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildBrandTokens, type BrandInput, type BrandTokens } from '@/lib/color'

export type ColorMode = 'dark' | 'light' | 'system'

interface ThemeContextValue {
  mode: ColorMode
  resolvedMode: 'dark' | 'light'
  setMode: (mode: ColorMode) => void
  brand: BrandTokens
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'es-color-mode'
const DEFAULT_BRAND: BrandInput = { primary: '#0b0b0c', accent: '#c8ff2e' }

function leerModo(fallback: ColorMode): ColorMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* almacenamiento no disponible */
  }
  return fallback
}

function sistemaOscuro(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

interface Props {
  /** Colores de la tienda activa; si falta, se usa la marca Elite Sport. */
  brand?: Partial<BrandInput> | null
  defaultMode?: ColorMode
  children: ReactNode
}

/**
 * Aplica el modo (claro/oscuro) y los colores de la tienda activa como variables CSS
 * sobre <html>. Los colores pasan por `buildBrandTokens`, que garantiza contraste AA.
 */
export function ThemeProvider({ brand, defaultMode = 'dark', children }: Props) {
  const [mode, setModeState] = useState<ColorMode>(() => leerModo(defaultMode))
  const [prefiereOscuro, setPrefiereOscuro] = useState(sistemaOscuro)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefiereOscuro(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolvedMode = mode === 'system' ? (prefiereOscuro ? 'dark' : 'light') : mode

  const tokens = useMemo(
    () =>
      buildBrandTokens({
        primary: brand?.primary ?? DEFAULT_BRAND.primary,
        accent: brand?.accent ?? DEFAULT_BRAND.accent,
      }),
    [brand?.primary, brand?.accent],
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedMode === 'dark')
  }, [resolvedMode])

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--brand-primary', tokens.primary)
    root.style.setProperty('--brand-primary-fg', tokens.primaryFg)
    root.style.setProperty('--brand-accent', tokens.accent)
    root.style.setProperty('--brand-accent-fg', tokens.accentFg)
    return () => {
      for (const p of ['--brand-primary', '--brand-primary-fg', '--brand-accent', '--brand-accent-fg']) {
        root.style.removeProperty(p)
      }
    }
  }, [tokens])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedMode,
      brand: tokens,
      setMode: (m) => {
        setModeState(m)
        try {
          localStorage.setItem(STORAGE_KEY, m)
        } catch {
          /* ignorar */
        }
      },
    }),
    [mode, resolvedMode, tokens],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return ctx
}

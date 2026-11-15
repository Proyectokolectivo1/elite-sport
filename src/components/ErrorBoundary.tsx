import { Component, type ErrorInfo, type ReactNode } from 'react'

const CLAVE = 'recarga-por-version'

/** El navegador no pudo bajar un archivo de la página: casi siempre porque se publicó una versión nueva mientras estaba abierta. */
export function esErrorDeCarga(e: unknown): boolean {
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /dynamically imported module|Importing a module script failed|Loading chunk|Loading CSS chunk|ChunkLoadError|text\/html/i.test(m)
}

/** Recarga una sola vez por pestaña para tomar la versión nueva. Devuelve false si ya se intentó (evita bucles). */
export function recargarPorVersionNueva(): boolean {
  try {
    if (sessionStorage.getItem(CLAVE)) return false
    sessionStorage.setItem(CLAVE, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

interface Props {
  children: ReactNode
}
interface Estado {
  error: Error | null
}

/**
 * Última red de la aplicación: si algo falla al dibujar o al descargar una página,
 * se muestra un aviso con salida en vez de dejar la pantalla en negro.
 */
export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: Error): Estado {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (esErrorDeCarga(error)) recargarPorVersionNueva()
    else console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    const nueva = esErrorDeCarga(this.state.error)
    return (
      <main role="alert" className="grid min-h-dvh place-items-center bg-background px-[var(--gutter,1rem)] text-foreground">
        <div className="max-w-md space-y-4">
          <h1 className="text-5xl">{nueva ? 'Hay una versión nueva' : 'Algo salió mal'}</h1>
          <p className="text-muted-foreground">
            {nueva ? 'Actualizamos la tienda mientras la tenías abierta. Recarga para ver la última versión.' : 'No pudimos mostrar esta página. Recárgala; si sigue igual, vuelve al inicio.'}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                try { sessionStorage.removeItem(CLAVE) } catch { /* sin almacenamiento: se recarga igual */ }
                window.location.reload()
              }}
              className="inline-flex h-11 items-center bg-[var(--brand-accent,#c8ff2e)] px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--brand-accent-fg,#0b0b0c)]"
            >
              Recargar
            </button>
            <a href="/" className="inline-flex h-11 items-center border border-border px-6 text-sm font-semibold uppercase tracking-[0.1em]">Ir al inicio</a>
          </div>
        </div>
      </main>
    )
  }
}

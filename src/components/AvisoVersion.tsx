import { useEffect, useState } from 'react'

/** Archivo de entrada con hash del documento (ej. /assets/index-AbC123.js), o null en desarrollo. */
function entrada(html: string | Document): string | null {
  if (typeof html === 'string') return /\/assets\/index-[\w-]+\.js/.exec(html)?.[0] ?? null
  const s = html.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]')
  return s ? new URL(s.src).pathname : null
}

/**
 * Detecta que se publicó una versión nueva mientras la pestaña seguía abierta y ofrece actualizar.
 * Se comprueba al volver a la pestaña (y cada 10 minutos): así nadie navega con archivos viejos que ya no existen.
 */
export function AvisoVersion() {
  const [hayNueva, setHayNueva] = useState(false)

  useEffect(() => {
    const actual = entrada(document)
    if (!actual) return
    let activo = true
    async function revisar() {
      try {
        const r = await fetch('/', { cache: 'no-store', headers: { accept: 'text/html' } })
        const publicada = entrada(await r.text())
        if (activo && publicada && publicada !== actual) setHayNueva(true)
      } catch {
        // Sin red: se revisa en la próxima ocasión.
      }
    }
    const alVolver = () => {
      if (document.visibilityState === 'visible') void revisar()
    }
    document.addEventListener('visibilitychange', alVolver)
    const cada = window.setInterval(() => void revisar(), 10 * 60_000)
    return () => {
      activo = false
      document.removeEventListener('visibilitychange', alVolver)
      window.clearInterval(cada)
    }
  }, [])

  if (!hayNueva) return null
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-border bg-[var(--brand-accent,#c8ff2e)] px-4 py-2 text-sm text-[var(--brand-accent-fg,#0b0b0c)]">
      <span>Hay una versión nueva de Elite Sport.</span>
      <button type="button" onClick={() => window.location.reload()} className="font-semibold underline underline-offset-4">
        Actualizar ahora
      </button>
    </div>
  )
}

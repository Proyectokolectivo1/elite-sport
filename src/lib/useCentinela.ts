import { useEffect, useRef, type RefObject } from 'react'

/**
 * Scroll infinito: llama a `alVer` cuando el elemento centinela está por entrar en pantalla
 * (con 600 px de margen, para pedir el siguiente lote antes de que la persona llegue al final).
 */
export function useCentinela(alVer: () => void, activo: boolean): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement>(null)
  const callback = useRef(alVer)
  useEffect(() => {
    callback.current = alVer
  })
  useEffect(() => {
    const el = ref.current
    if (!el || !activo) return
    const obs = new IntersectionObserver((e) => e[0].isIntersecting && callback.current(), { rootMargin: '600px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [activo])
  return ref
}

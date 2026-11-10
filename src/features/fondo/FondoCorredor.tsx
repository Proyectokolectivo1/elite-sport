import { useEffect, useRef, useState } from 'react'
import { progresoScroll, suavizar, tiempoObjetivo } from './scroll'

export interface FondoConfig {
  video: string | null
  videoMovil: string | null
  poster: string | null
  /** Opacidad de la capa que oscurece/aclara el video para que el texto se lea (0.3 a 0.95). */
  opacidad: number
}

interface ConexionNavigator extends Navigator {
  connection?: { saveData?: boolean; effectiveType?: string }
}

function usaPocosDatos(): boolean {
  const c = (navigator as ConexionNavigator).connection
  return !!c && (c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g')
}

/**
 * Video a pantalla completa detrás de toda la página. No se reproduce: su tiempo avanza con el scroll
 * (la persona corre a medida que se baja). Con "reducir movimiento" o ahorro de datos solo se ve la imagen fija.
 */
export function FondoCorredor({ video, videoMovil, poster, opacidad }: FondoConfig) {
  const ref = useRef<HTMLVideoElement>(null)
  const [movil, setMovil] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [quieto] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches || usaPocosDatos())
  const [listo, setListo] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const alCambiar = (e: MediaQueryListEvent) => setMovil(e.matches)
    mq.addEventListener('change', alCambiar)
    return () => mq.removeEventListener('change', alCambiar)
  }, [])

  const src = (movil ? (videoMovil ?? video) : video) ?? null

  useEffect(() => {
    const el = ref.current
    if (!el || !src || quieto) return
    let raf = 0
    let actual = 0
    let activo = true

    const arrancar = () => {
      // Algunos navegadores móviles solo "despiertan" el video tras un play/pause silencioso.
      void el.play().then(() => el.pause()).catch(() => undefined)
      setListo(true)
    }
    if (el.readyState >= 1) arrancar()
    else el.addEventListener('loadedmetadata', arrancar, { once: true })

    const paso = () => {
      if (!activo) return
      if (!document.hidden && el.readyState >= 1 && Number.isFinite(el.duration)) {
        const objetivo = tiempoObjetivo(progresoScroll(window.scrollY, document.documentElement.scrollHeight, window.innerHeight), el.duration)
        actual = suavizar(actual, objetivo)
        // Un seek a la vez y solo si el cambio se nota (evita saturar el decodificador en móviles).
        if (!el.seeking && Math.abs(el.currentTime - actual) > 1 / 30) el.currentTime = actual
      }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => {
      activo = false
      cancelAnimationFrame(raf)
      el.removeEventListener('loadedmetadata', arrancar)
    }
  }, [src, quieto])

  // Cada imagen o video se pide una sola vez; el video móvil es más ligero.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      {src && !quieto && (
        <video
          key={src}
          ref={ref}
          src={src}
          poster={poster ?? undefined}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          className={`size-full object-cover transition-opacity duration-500 ${listo ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {poster && (quieto || !listo) && <img src={poster} alt="" className="absolute inset-0 size-full object-cover" />}
      <div className="absolute inset-0" style={{ backgroundColor: `color-mix(in oklab, var(--background) ${Math.round(opacidad * 100)}%, transparent)` }} />
    </div>
  )
}

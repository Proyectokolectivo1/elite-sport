/** Alerta sonora hecha con Web Audio: no necesita archivos de sonido. */
const CLAVE = 'avisos-sonido'

export function sonidoActivo(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== 'off'
  } catch {
    return true
  }
}

export function guardarSonido(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE, activo ? 'on' : 'off')
  } catch {
    /* sin almacenamiento: queda activo en esta sesion */
  }
}

let ctx: AudioContext | null = null

/**
 * Alerta de pedido nuevo: tres repeticiones de un "ding-dong" con onda cuadrada (timbre de caja registradora),
 * fuerte y de unos 2 segundos, para que se oiga aunque haya ruido en la bodega. Pasa por un compresor
 * para subir el volumen sin que se deforme.
 */
export function sonarAviso(): void {
  if (!sonidoActivo() || typeof window === 'undefined') return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const c = ctx
    const t0 = c.currentTime + 0.02

    const salida = c.createDynamicsCompressor()
    salida.threshold.value = -18
    salida.ratio.value = 6
    const volumen = c.createGain()
    volumen.gain.value = 1.4
    salida.connect(volumen).connect(c.destination)

    const nota = (frecuencia: number, inicio: number, duracion: number) => {
      // Cuadrada (cuerpo) + sinusoidal una octava arriba (brillo).
      for (const [tipo, mult, pico] of [['square', 1, 0.32], ['sine', 2, 0.28]] as const) {
        const osc = c.createOscillator()
        const g = c.createGain()
        osc.type = tipo
        osc.frequency.value = frecuencia * mult
        g.gain.setValueAtTime(0.0001, inicio)
        g.gain.exponentialRampToValueAtTime(pico, inicio + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion)
        osc.connect(g).connect(salida)
        osc.start(inicio)
        osc.stop(inicio + duracion + 0.02)
      }
    }

    for (let r = 0; r < 3; r++) {
      const base = t0 + r * 0.72
      nota(988, base, 0.28) // si
      nota(740, base + 0.3, 0.38) // fa#
    }
  } catch {
    /* el navegador bloqueo el audio hasta que la persona toque la pagina: no pasa nada */
  }
}

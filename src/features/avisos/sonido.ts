/** Tono corto de dos notas hecho con Web Audio: no necesita archivos de sonido. */
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

export function sonarAviso(): void {
  if (!sonidoActivo() || typeof window === 'undefined') return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const t0 = ctx.currentTime
    ;[660, 880].forEach((f, i) => {
      const osc = ctx!.createOscillator()
      const g = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = f
      g.gain.setValueAtTime(0.0001, t0 + i * 0.16)
      g.gain.exponentialRampToValueAtTime(0.18, t0 + i * 0.16 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.16 + 0.22)
      osc.connect(g).connect(ctx!.destination)
      osc.start(t0 + i * 0.16)
      osc.stop(t0 + i * 0.16 + 0.24)
    })
  } catch {
    /* el navegador bloqueo el audio hasta que la persona toque la pagina: no pasa nada */
  }
}

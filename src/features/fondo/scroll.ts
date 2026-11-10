/** Avance del scroll de toda la página, de 0 (arriba) a 1 (abajo). */
export function progresoScroll(scrollY: number, altoDocumento: number, altoVentana: number): number {
  const recorrido = altoDocumento - altoVentana
  if (recorrido <= 0) return 0
  return Math.min(1, Math.max(0, scrollY / recorrido))
}

/** Segundo del video que corresponde a ese avance (se queda un poco antes del final para no saltar al inicio). */
export function tiempoObjetivo(progreso: number, duracion: number): number {
  if (!Number.isFinite(duracion) || duracion <= 0) return 0
  return Math.min(1, Math.max(0, progreso)) * Math.max(0, duracion - 0.05)
}

/** Acerca `actual` a `objetivo` de forma suave; si ya está muy cerca, lo iguala. */
export function suavizar(actual: number, objetivo: number, factor = 0.14, umbral = 0.01): number {
  const d = objetivo - actual
  return Math.abs(d) < umbral ? objetivo : actual + d * factor
}

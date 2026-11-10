export interface LineaIngreso {
  tallaId: string
  /** Pares por caja de esa talla (en ingreso por unidad no se usa). */
  pares: number
  /** Total manual; si no existe se calcula pares × cajas. */
  totalManual?: number
}

export interface LineaCalculada {
  tallaId: string
  pares: number
  total: number
}

/** Convierte el surtido de una caja a unidades por talla: pares × número de cajas, editable por talla. */
export function calcularLineas(lineas: LineaIngreso[], cajas: number): LineaCalculada[] {
  const n = Number.isFinite(cajas) && cajas > 0 ? Math.floor(cajas) : 0
  return lineas.map((l) => ({
    tallaId: l.tallaId,
    pares: l.pares,
    total: l.totalManual ?? Math.max(0, Math.floor(l.pares)) * n,
  }))
}

export function totalUnidades(lineas: LineaCalculada[]): number {
  return lineas.reduce((s, l) => s + l.total, 0)
}

export function paresPorCaja(lineas: LineaIngreso[]): number {
  return lineas.reduce((s, l) => s + Math.max(0, Math.floor(l.pares)), 0)
}

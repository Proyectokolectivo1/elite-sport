import type { Pieza, PiezaVendedor } from './schemas'

export const NOMBRE_PIEZA: Record<Pieza, string> = { par: 'Par completo', derecho: 'Pie derecho', izquierdo: 'Pie izquierdo' }

const local = (nombre: string) => `Local ${nombre}`

/** Pares que se pueden armar con lo que hay en exhibición: cada par completo y cada derecho con un izquierdo. */
export function paresEnExhibicion(piezas: { pieza: Pieza }[]): number {
  const n = (p: Pieza) => piezas.filter((x) => x.pieza === p).length
  return n('par') + Math.min(n('derecho'), n('izquierdo'))
}

/** Solo queda mercancía de exhibición: lo que hay en stock no alcanza más que para esos pares. */
export function soloExhibicion(stock: number, piezas: { pieza: Pieza }[]): boolean {
  const ex = paresEnExhibicion(piezas)
  return ex > 0 && stock > 0 && stock - ex <= 0
}

export interface OpcionExhibicion {
  /** Ids de las piezas que se venden juntas (uno para un par completo, dos para un par armado). */
  ids: string[]
  texto: string
  propia: boolean
}

/** Cómo puede vender el vendedor la exhibición de una talla: pares completos y pares armados (derecho + izquierdo). */
export function opcionesExhibicion(piezas: PiezaVendedor[]): OpcionExhibicion[] {
  const primero = (a: PiezaVendedor, b: PiezaVendedor) => Number(b.propia) - Number(a.propia)
  const de = (p: Pieza) => piezas.filter((x) => x.pieza === p).sort(primero)
  const donde = (x: PiezaVendedor) => (x.propia ? 'tu local' : local(x.local))
  const opciones: OpcionExhibicion[] = de('par').map((x) => ({
    ids: [x.id],
    texto: `Par completo en ${donde(x)}`,
    propia: x.propia,
  }))
  const der = de('derecho')
  const izq = de('izquierdo')
  for (let i = 0; i < Math.min(der.length, izq.length); i++) {
    opciones.push({
      ids: [der[i].id, izq[i].id],
      texto: `Derecho en ${donde(der[i])} + izquierdo en ${donde(izq[i])}`,
      propia: der[i].propia && izq[i].propia,
    })
  }
  return opciones
}

/** Texto de una pieza para bodega: "derecho del Local KZ". */
export function textoPieza(pieza: Pieza, nombreLocal: string): string {
  return `${pieza === 'par' ? 'par completo' : pieza === 'derecho' ? 'derecho' : 'izquierdo'} del ${local(nombreLocal)}`
}

/** Revisa las piezas de exhibición del formulario de producto. Devuelve el mensaje del primer problema, o null si todo está bien. */
export function validarFilasExhibicion(filas: { color: string; talla: string; pieza: Pieza; localId: string }[]): string | null {
  for (const f of filas) {
    if (!f.color.trim() || !f.talla || !f.localId) return 'Cada pieza de exhibición necesita color, talla y local.'
  }
  const grupos = new Map<string, { der: number; izq: number; color: string; talla: string }>()
  for (const f of filas) {
    const k = `${f.color.trim().toLowerCase()}|${f.talla}`
    const g = grupos.get(k) ?? { der: 0, izq: 0, color: f.color.trim(), talla: f.talla }
    if (f.pieza === 'derecho') g.der++
    if (f.pieza === 'izquierdo') g.izq++
    grupos.set(k, g)
  }
  for (const g of grupos.values()) {
    if (g.der !== g.izq) return `En ${g.color} talla ${g.talla}, cada pie derecho necesita su pie izquierdo (misma talla y color).`
  }
  return null
}

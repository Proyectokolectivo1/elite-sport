/** Utilidades de color y contraste (WCAG 2.x). Trabajan con hex #RRGGBB. */

export const INK = '#0b0b0c'
export const BONE = '#f4f2ed'

export type Rgb = readonly [number, number, number]

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Mezcla `hex` con `target` (t = 0..1). */
export function mix(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  return rgbToHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}

/** Texto (tinta u hueso) con mejor contraste sobre `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio(bg, INK) >= contrastRatio(bg, BONE) ? INK : BONE
}

/**
 * Ajusta `fg` hasta alcanzar `min` de contraste sobre `bg`, desplazándolo hacia
 * negro o blanco (el que más contraste dé). Si ya cumple, lo devuelve igual.
 */
export function ensureContrast(fg: string, bg: string, min = 4.5): string {
  if (contrastRatio(fg, bg) >= min) return fg
  const target = contrastRatio('#000000', bg) >= contrastRatio('#ffffff', bg) ? '#000000' : '#ffffff'
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const candidate = mix(fg, target, t)
    if (contrastRatio(candidate, bg) >= min) return candidate
  }
  return target
}

export interface BrandInput {
  primary: string
  accent: string
}

export interface BrandTokens {
  primary: string
  primaryFg: string
  accent: string
  accentFg: string
  /** true si hubo que corregir algún color para cumplir el contraste */
  adjusted: boolean
}

/**
 * Convierte los colores elegidos por una tienda en tokens que cumplen AA:
 * - el texto sobre el primario es tinta u hueso, el que más contraste dé;
 * - el acento debe leerse (3:1, elemento gráfico) sobre el primario; si no, se ajusta;
 * - el texto sobre el acento es tinta u hueso.
 */
export function buildBrandTokens({ primary, accent }: BrandInput): BrandTokens {
  const p = isHex(primary) ? primary.toLowerCase() : INK
  const a0 = isHex(accent) ? accent.toLowerCase() : '#c8ff2e'
  const a = ensureContrast(a0, p, 3)
  return {
    primary: p,
    primaryFg: readableOn(p),
    accent: a,
    accentFg: readableOn(a),
    adjusted: a !== a0 || !isHex(primary) || !isHex(accent),
  }
}

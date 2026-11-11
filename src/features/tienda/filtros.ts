import type { FiltrosBusqueda, GrupoTalla, ProductoPublico } from './api/tienda'

export type Orden = 'novedades' | 'precio-asc' | 'precio-desc' | 'nombre'

export interface Filtros {
  q: string
  grupo: GrupoTalla | ''
  marca: string
  estilo: string
  categoria: string
  talla: string
  min: number | null
  max: number | null
  orden: Orden
}

export const FILTROS_VACIOS: Filtros = { q: '', grupo: '', marca: '', estilo: '', categoria: '', talla: '', min: null, max: null, orden: 'novedades' }

const num = (v: string | null): number | null => {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : null
}

const GRUPOS = ['dama', 'caballero', 'nino']
const ORDENES: Orden[] = ['novedades', 'precio-asc', 'precio-desc', 'nombre']

export function filtrosDesdeUrl(p: URLSearchParams): Filtros {
  const g = p.get('g') ?? ''
  const o = p.get('orden') as Orden | null
  return {
    q: p.get('q') ?? '',
    grupo: GRUPOS.includes(g) ? (g as GrupoTalla) : '',
    marca: p.get('marca') ?? '',
    estilo: p.get('estilo') ?? '',
    categoria: p.get('cat') ?? '',
    talla: p.get('talla') ?? '',
    min: num(p.get('min')),
    max: num(p.get('max')),
    orden: o && ORDENES.includes(o) ? o : 'novedades',
  }
}

export function filtrosAUrl(f: Filtros): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.grupo) p.set('g', f.grupo)
  if (f.marca) p.set('marca', f.marca)
  if (f.estilo) p.set('estilo', f.estilo)
  if (f.categoria) p.set('cat', f.categoria)
  if (f.talla) p.set('talla', f.talla)
  if (f.min !== null) p.set('min', String(f.min))
  if (f.max !== null) p.set('max', String(f.max))
  if (f.orden !== 'novedades') p.set('orden', f.orden)
  return p
}

export function contarFiltros(f: Filtros): number {
  return [f.grupo, f.marca, f.estilo, f.categoria, f.talla].filter(Boolean).length + (f.min !== null ? 1 : 0) + (f.max !== null ? 1 : 0)
}

export function totalStock(p: ProductoPublico): number {
  return p.variantes.reduce((s, v) => s + v.stock, 0)
}

/** Filtros de la URL en el formato que entiende la búsqueda del servidor. */
export function filtrosAServidor(f: Filtros): FiltrosBusqueda {
  return { q: f.q, grupo: f.grupo, marca: f.marca, estilo: f.estilo, categoria: f.categoria, talla: f.talla, min: f.min, max: f.max, orden: f.orden }
}

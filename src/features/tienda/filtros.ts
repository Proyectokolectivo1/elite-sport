import type { GrupoTalla, ProductoPublico } from './api/tienda'

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

/** Filtra y ordena. `precio` resuelve el precio de la tienda activa (PVP o el del mayorista). */
export function filtrarProductos(productos: ProductoPublico[], f: Filtros, precio: (p: ProductoPublico) => number): ProductoPublico[] {
  const q = f.q.trim().toLowerCase()
  const lista = productos.filter((p) => {
    if (f.grupo && p.grupo !== f.grupo) return false
    if (f.marca && p.marca?.id !== f.marca) return false
    if (f.estilo && p.estilo?.id !== f.estilo) return false
    if (f.categoria && p.categoria?.id !== f.categoria) return false
    if (f.talla && !p.variantes.some((v) => v.talla === f.talla && v.stock > 0)) return false
    const pr = precio(p)
    if (f.min !== null && pr < f.min) return false
    if (f.max !== null && pr > f.max) return false
    if (q && !`${p.nombre} ${p.marca?.nombre ?? ''} ${p.categoria?.nombre ?? ''} ${p.estilo?.nombre ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
  const ord = [...lista]
  if (f.orden === 'precio-asc') ord.sort((a, b) => precio(a) - precio(b))
  else if (f.orden === 'precio-desc') ord.sort((a, b) => precio(b) - precio(a))
  else if (f.orden === 'nombre') ord.sort((a, b) => a.nombre.localeCompare(b.nombre))
  else ord.sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
  return ord
}

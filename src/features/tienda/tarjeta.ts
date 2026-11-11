import type { ProductCardData } from '@/components/ui/product-card'
import type { ProductoPublico } from './api/tienda'
import { totalStock } from './filtros'

/** Texto de tallas disponibles, ej. "Tallas 38 a 45". */
export function textoTallas(p: ProductoPublico): string | undefined {
  const tallas = p.variantes.filter((v) => v.stock > 0)
  if (tallas.length === 0) return undefined
  const unicas = [...new Map(tallas.map((v) => [v.talla, v.orden])).entries()].sort((a, b) => a[1] - b[1]).map(([t]) => t)
  return unicas.length === 1 ? `Talla ${unicas[0]}` : `Tallas ${unicas[0]} a ${unicas[unicas.length - 1]}`
}

export function aTarjeta(p: ProductoPublico): ProductCardData {
  return {
    nombre: p.nombre,
    marca: p.marca?.nombre,
    // Las tarjetas usan la miniatura (480 px); las fotos antiguas sin miniatura caen a la grande.
    imagenUrl: p.imagenes[0]?.miniatura ?? p.imagenes[0]?.url,
    precio: p.precio,
    tallas: textoTallas(p),
    agotado: p.variantes.length > 0 && totalStock(p) === 0,
    destacado: p.destacado,
  }
}

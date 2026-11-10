import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ItemCarrito {
  varianteId: string
  productoId: string
  nombre: string
  color: string
  talla: string
  imagen: string | null
  precio: number
  cantidad: number
  /** Stock visto al agregar; tope de la cantidad. */
  stock: number
}

interface CarritoState {
  /** Un carrito por tienda: no se mezclan pedidos de tiendas distintas. */
  porTienda: Record<string, ItemCarrito[]>
  agregar: (tienda: string, item: Omit<ItemCarrito, 'cantidad'>, cantidad?: number) => void
  cambiarCantidad: (tienda: string, varianteId: string, cantidad: number) => void
  quitar: (tienda: string, varianteId: string) => void
  vaciar: (tienda: string) => void
}

export const useCarritoStore = create<CarritoState>()(
  persist(
    (set) => ({
      porTienda: {},
      agregar: (tienda, item, cantidad = 1) =>
        set((s) => {
          const lista = s.porTienda[tienda] ?? []
          const existente = lista.find((i) => i.varianteId === item.varianteId)
          const siguiente = existente
            ? lista.map((i) => (i.varianteId === item.varianteId ? { ...i, precio: item.precio, stock: item.stock, cantidad: Math.min(item.stock, i.cantidad + cantidad) } : i))
            : [...lista, { ...item, cantidad: Math.min(item.stock, cantidad) }]
          return { porTienda: { ...s.porTienda, [tienda]: siguiente } }
        }),
      cambiarCantidad: (tienda, varianteId, cantidad) =>
        set((s) => ({
          porTienda: {
            ...s.porTienda,
            [tienda]: (s.porTienda[tienda] ?? []).map((i) => (i.varianteId === varianteId ? { ...i, cantidad: Math.max(1, Math.min(i.stock, cantidad)) } : i)),
          },
        })),
      quitar: (tienda, varianteId) =>
        set((s) => ({ porTienda: { ...s.porTienda, [tienda]: (s.porTienda[tienda] ?? []).filter((i) => i.varianteId !== varianteId) } })),
      vaciar: (tienda) => set((s) => ({ porTienda: { ...s.porTienda, [tienda]: [] } })),
    }),
    { name: 'es-carrito', version: 1 },
  ),
)

export function totalCarrito(items: ItemCarrito[]): number {
  return Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100
}

export function unidadesCarrito(items: ItemCarrito[]): number {
  return items.reduce((s, i) => s + i.cantidad, 0)
}

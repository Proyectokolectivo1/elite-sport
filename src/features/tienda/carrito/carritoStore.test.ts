import { beforeEach, describe, expect, it } from 'vitest'
import { totalCarrito, unidadesCarrito, useCarritoStore } from './carritoStore'

const item = { varianteId: 'v1', productoId: 'p1', nombre: 'Runner', color: 'Negro', talla: '40', imagen: null, precio: 89.9, stock: 3 }

describe('carrito', () => {
  beforeEach(() => useCarritoStore.setState({ porTienda: {} }))

  it('suma cantidades del mismo producto sin pasar el stock', () => {
    const { agregar } = useCarritoStore.getState()
    agregar('principal', item, 2)
    agregar('principal', item, 5)
    expect(useCarritoStore.getState().porTienda.principal[0].cantidad).toBe(3)
  })

  it('mantiene carritos separados por tienda', () => {
    const { agregar } = useCarritoStore.getState()
    agregar('principal', item)
    agregar('maria', item)
    useCarritoStore.getState().vaciar('maria')
    expect(useCarritoStore.getState().porTienda.principal).toHaveLength(1)
    expect(useCarritoStore.getState().porTienda.maria).toHaveLength(0)
  })

  it('calcula total y unidades', () => {
    const { agregar } = useCarritoStore.getState()
    agregar('principal', item, 2)
    const lista = useCarritoStore.getState().porTienda.principal
    expect(totalCarrito(lista)).toBe(179.8)
    expect(unidadesCarrito(lista)).toBe(2)
  })
})

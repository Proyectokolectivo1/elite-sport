import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}))
vi.mock('../hooks/useBodega', async (orig) => {
  const m = await orig<typeof import('../hooks/useBodega')>()
  return { ...m, useFotoDeVariante: () => () => null }
})

import { CierreEntrega } from './CierreEntrega'
import type { PedidoBodega } from '../api/bodega'

const pedido: PedidoBodega = {
  id: 'p1', numero: 10, tipo: 'consignacion', estado: 'entregado', creado_en: '', despachado_en: null, liquidado_en: null,
  nota: null, solicitante_id: 'u1', solicitante_nombre: 'Izao', solicitante_rol: 'vendedor', cliente_nombre: '', cliente_telefono: '',
  cliente_direccion: null,
  lineas: [{ id: 'd1', variante_id: 'v1', descripcion: 'Adidas runner · Blanco Negro · talla 44', cantidad: 1, cantidad_entregada: 1, cantidad_vendida: 1, cantidad_devuelta: 0, stock: 3 }],
}

describe('cierre de entrega', () => {
  it('Cerrar entrega llama al RPC con vendidos y devueltos', async () => {
    rpc.mockResolvedValue({ data: { id: 'p1', venta_sin_registrar: null }, error: null })
    render(<QueryClientProvider client={new QueryClient()}><CierreEntrega pedido={pedido} /></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: /cerrar entrega/i }))
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(rpc).toHaveBeenCalledWith('cerrar_pedido_bodega', { p_pedido: 'p1', p_lineas: [{ detalle_id: 'd1', vendidos: 1, devueltos: 0 }] })
  })
})

describe('devolver un par registrado como vendido', () => {
  it('libera la venta antes de cerrar', async () => {
    rpc.mockReset()
    rpc.mockResolvedValue({ data: { id: 'p1', venta_sin_registrar: null }, error: null })
    render(<QueryClientProvider client={new QueryClient()}><CierreEntrega pedido={pedido} /></QueryClientProvider>)
    const campo = screen.getByLabelText(/^Regresan de/) as HTMLInputElement
    expect(campo.disabled).toBe(false)
    fireEvent.change(campo, { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /cerrar entrega/i }))
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2))
    expect(rpc).toHaveBeenNthCalledWith(1, 'liberar_ventas_registradas', { p_pedido: 'p1', p_lineas: [{ detalle_id: 'd1', cantidad: 1 }] })
    expect(rpc).toHaveBeenNthCalledWith(2, 'cerrar_pedido_bodega', { p_pedido: 'p1', p_lineas: [{ detalle_id: 'd1', vendidos: 0, devueltos: 1 }] })
  })
})

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const escuchar = vi.hoisted(() => ({ alCambiar: null as null | (() => void), dejar: vi.fn() }))
vi.mock('./api', () => ({
  escucharCambiosPedidos: (fn: () => void) => {
    escuchar.alCambiar = fn
    return escuchar.dejar
  },
}))

import { usePedidosEnVivo } from './usePedidosEnVivo'

afterEach(() => {
  vi.useRealTimers()
  escuchar.alCambiar = null
  escuchar.dejar.mockClear()
})

describe('pedidos en vivo', () => {
  it('refresca las listas de pedidos al llegar un aviso, agrupando los seguidos', () => {
    vi.useFakeTimers()
    const qc = new QueryClient()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    const envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { unmount } = renderHook(() => usePedidosEnVivo(true), { wrapper: envoltura })

    escuchar.alCambiar?.()
    escuchar.alCambiar?.()
    vi.advanceTimersByTime(400)
    expect(invalidar).toHaveBeenCalledTimes(1)
    const filtro = invalidar.mock.calls[0][0]
    const coincide = (clave: string) => filtro?.predicate?.({ queryKey: [clave] } as never)
    expect(coincide('bodega')).toBe(true)
    expect(coincide('avisos')).toBe(true)
    expect(coincide('productos')).toBe(false)

    unmount()
    expect(escuchar.dejar).toHaveBeenCalled()
  })

  it('no escucha si no hay sesión', () => {
    const qc = new QueryClient()
    const envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    renderHook(() => usePedidosEnVivo(false), { wrapper: envoltura })
    expect(escuchar.alCambiar).toBeNull()
  })
})

import { expect, test, type Page, type Route } from '@playwright/test'

/** Genera `n` productos falsos con el formato que devuelve el servidor, para probar el scroll infinito sin tocar datos reales. */
function productoFalso(i: number) {
  return {
    id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    slug: `modelo-${i}`,
    nombre: `Modelo ${i}`,
    grupo: 'caballero',
    descripcion: null,
    precio_publico: 50 + i,
    destacado: false,
    creado_en: '2026-01-01T00:00:00Z',
    marcas: null,
    categorias: null,
    estilos: null,
  }
}

async function simularCatalogoGrande(page: Page, total: number) {
  const pedidosRpc: { desde: number; limite: number }[] = []
  await page.route('**/rest/v1/rpc/buscar_productos', async (route: Route) => {
    const cuerpo = route.request().postDataJSON() as { p_desde: number; p_limite: number }
    pedidosRpc.push({ desde: cuerpo.p_desde, limite: cuerpo.p_limite })
    const filas = Array.from({ length: Math.max(0, Math.min(cuerpo.p_limite, total - cuerpo.p_desde)) }, (_, k) => {
      const i = cuerpo.p_desde + k + 1
      return { id: productoFalso(i).id, precio: 50 + i, total }
    })
    await route.fulfill({ json: filas })
  })
  await page.route('**/rest/v1/productos?*', async (route: Route) => {
    const url = decodeURIComponent(route.request().url())
    const ids = (url.match(/id=in\.\(([^)]*)\)/)?.[1] ?? '').split(',').filter(Boolean)
    await route.fulfill({ json: ids.map((id) => productoFalso(Number(id.slice(-12)))) })
  })
  await page.route('**/rest/v1/imagenes_producto?*', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/variantes_producto?*', (r) => r.fulfill({ json: [] }))
  return pedidosRpc
}

test.describe('rendimiento', () => {
  test('el catálogo pide los productos por lotes mientras se baja', async ({ page }) => {
    const pedidos = await simularCatalogoGrande(page, 60)
    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { level: 2, name: 'Modelo 1', exact: true })).toBeVisible()
    // Primer lote: solo 12 de 60 productos.
    expect(pedidos[0]).toEqual({ desde: 0, limite: 12 })
    await expect(page.getByText('60 productos')).toBeVisible()
    expect(await page.getByRole('heading', { level: 2 }).count()).toBeLessThanOrEqual(15)

    // Al bajar al final aparece el siguiente lote, sin pulsar nada.
    await page.mouse.wheel(0, 6000)
    await expect.poll(() => pedidos.some((p) => p.desde === 12), { timeout: 8000 }).toBe(true)
    // El lote nuevo ya está en la página (las tarjetas fuera de pantalla no se pintan hasta que se llega a ellas).
    await expect(page.getByRole('heading', { level: 2, name: 'Modelo 13', exact: true })).toBeAttached()
  })

  test('con red lenta el catálogo muestra esqueletos y luego los productos', async ({ page, context }) => {
    test.setTimeout(60_000)
    await simularCatalogoGrande(page, 24)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    // "3G lenta": 400 kbps, 400 ms de latencia.
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('heading', { level: 2, name: 'Modelo 1', exact: true })).toBeVisible({ timeout: 20000 })
  })

  test('las fotos del catálogo se piden con carga diferida y decodificación asíncrona', async ({ page }) => {
    await simularCatalogoGrande(page, 12)
    await page.route('**/rest/v1/imagenes_producto?*', (r) =>
      r.fulfill({ json: [{ producto_id: productoFalso(1).id, color: 'Negro', url: 'https://x.supabase.co/foto.webp', url_miniatura: 'https://x.supabase.co/foto-m.webp', orden: 0 }] }),
    )
    const pedidasFoto: string[] = []
    await page.route('https://x.supabase.co/**', (r) => {
      pedidasFoto.push(r.request().url())
      return r.fulfill({ status: 200, contentType: 'image/webp', body: Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64') })
    })
    await page.goto('/catalogo')
    const img = page.locator('img[src$="foto-m.webp"]').first()
    await expect(img).toHaveAttribute('loading', 'lazy')
    await expect(img).toHaveAttribute('decoding', 'async')
    // La tarjeta usa la miniatura, no la foto grande.
    expect(pedidasFoto.every((u) => !u.endsWith('/foto.webp'))).toBe(true)
  })
})

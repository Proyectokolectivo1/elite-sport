import { expect, test, type Page } from '@playwright/test'

/**
 * Existencias del inventario con una sesión de bodeguero simulada: no hay cuenta real ni se toca la base.
 */
const REF = 'bjvwzqbvufckzlesnxzm'
const UID = '00000000-0000-4000-8000-000000000001'
const CONFIG = { id: 1, nombre_negocio: 'Elite Sport', ciudad: 'Guayaquil', moneda_codigo: 'USD', moneda_simbolo: '$', moneda_decimales: 2, locale: 'es-EC', whatsapp_principal: null, actualizado_en: new Date().toISOString() }

const variante = (id: string, productoId: string, producto: string, color: string, talla: string, orden: number, stock: number) => ({
  id, producto_id: productoId, color, sku: id, stock, productos: { nombre: producto }, tallas: { etiqueta: talla, orden },
})
const VARIANTES = [
  variante('a1', 'p-runner', 'Runner Pro Veloz', 'Negro', '39', 39, 0),
  variante('a2', 'p-runner', 'Runner Pro Veloz', 'Negro', '40', 40, 2),
  variante('a3', 'p-runner', 'Runner Pro Veloz', 'Negro', '41', 41, 9),
  variante('a4', 'p-runner', 'Runner Pro Veloz', 'Blanco', '40', 40, 6),
  variante('b1', 'p-aura', 'Aura Street', 'Rojo', '38', 38, 0),
  variante('b2', 'p-aura', 'Aura Street', 'Rojo', '39', 39, 0),
  variante('c1', 'p-nordik', 'Nordik Trail', 'Gris', '42', 42, 3),
  variante('c2', 'p-nordik', 'Nordik Trail', 'Gris', '43', 43, 2),
]

async function entrar(page: Page) {
  await page.addInitScript(({ ref, uid }) => {
    const t = Math.floor(Date.now() / 1000)
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'token-de-prueba', refresh_token: 'refresco-de-prueba', token_type: 'bearer', expires_in: 86400, expires_at: t + 86400,
      user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'prueba@t.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    }))
  }, { ref: REF, uid: UID })
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: {} }))
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/configuracion*', (r) => r.fulfill({ json: CONFIG }))
  await page.route('**/rest/v1/perfiles*', (r) =>
    r.fulfill({ json: [{ id: UID, rol: 'bodeguero', estado: 'aprobado', nombre: 'Prueba', negocio: null, telefono: null, cedula_ruc: null, ciudad: null, correo: 'prueba@t.test', direccion: null, aprobado_en: null, motivo_estado: null, creado_en: new Date().toISOString() }] }),
  )
  await page.route('**/rest/v1/variantes_producto*', (r) => r.fulfill({ json: VARIANTES }))
}

test.describe('inventario: existencias', () => {
  test('resume por producto y filtra por disponibilidad', async ({ page }) => {
    await entrar(page)
    await page.goto('/admin/inventario')
    const resumen = page.getByRole('region', { name: 'Resumen del inventario' })
    await expect(resumen.getByText('Pares en bodega')).toBeVisible()
    await expect(resumen.getByText('22', { exact: true })).toBeVisible()
    // Primero lo que urge: el agotado va antes que lo disponible.
    const items = page.locator('ul > li').filter({ has: page.getByRole('button', { name: /Ver tallas/ }) })
    await expect(items.first()).toContainText('Aura Street')
    await expect(items.first()).toContainText('Agotado')
    await page.getByRole('group', { name: 'Filtrar por disponibilidad' }).getByRole('button', { name: 'Stock bajo' }).click()
    await expect(page.getByRole('button', { name: /Nordik Trail/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Aura Street/ })).toHaveCount(0)
    await page.getByLabel('Buscar existencias').fill('runner')
    await expect(page.getByText('Sin resultados')).toBeVisible()
  })

  test('al abrir un producto se ven las tallas por color y se puede ajustar', async ({ page }) => {
    await entrar(page)
    const ajustes: unknown[] = []
    await page.route('**/rest/v1/rpc/ajustar_stock', (r) => {
      ajustes.push(r.request().postDataJSON())
      return r.fulfill({ status: 204, body: '' })
    })
    await page.goto('/admin/inventario')
    await page.getByRole('button', { name: /Runner Pro Veloz/ }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo.getByRole('region', { name: 'Color Negro' })).toContainText('11 pares')
    await expect(dialogo.getByRole('region', { name: 'Color Blanco' })).toContainText('6 pares')
    await expect(dialogo.getByRole('button', { name: /Talla 41: 9 pares/ })).toBeVisible()
    await expect(dialogo.getByRole('link', { name: 'Ingresar mercancía de este producto' })).toHaveAttribute('href', /producto=p-runner/)
    await dialogo.getByRole('button', { name: /Talla 40: 2 pares/ }).first().click()
    await dialogo.getByLabel('Cantidad a sumar o restar').fill('3')
    await dialogo.getByLabel('Motivo').fill('Conteo físico')
    await dialogo.getByRole('button', { name: 'Aplicar ajuste' }).click()
    await expect.poll(() => ajustes.length).toBe(1)
    expect(ajustes[0]).toEqual({ p_variante: 'a2', p_delta: 3, p_nota: 'Conteo físico' })
  })

  test('se lee bien sin desbordar en ningún ancho', async ({ page }) => {
    await entrar(page)
    await page.goto('/admin/inventario')
    await expect(page.getByRole('button', { name: /Runner Pro Veloz/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.getByRole('button', { name: /Runner Pro Veloz/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await page.screenshot({ path: `test-results/inventario-${page.viewportSize()?.width}.png` })
  })
})

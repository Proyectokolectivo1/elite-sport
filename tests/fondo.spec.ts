import { expect, test, type Page } from '@playwright/test'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function simularConfig(page: Page, extra: Record<string, unknown>) {
  await page.route('**/rest/v1/configuracion*', (r) =>
    r.fulfill({
      json: {
        id: 1, nombre_negocio: 'Elite Sport', ciudad: 'Guayaquil', moneda_codigo: 'USD', moneda_simbolo: '$', moneda_decimales: 2, locale: 'es-EC',
        whatsapp_principal: null, actualizado_en: new Date().toISOString(),
        fondo_activo: true, fondo_video_url: null, fondo_video_movil_url: null, fondo_poster_url: null, fondo_opacidad: 0.75,
        ...extra,
      },
    }),
  )
  await page.route('**/fondo-prueba.png', (r) => r.fulfill({ body: PNG, contentType: 'image/png' }))
  await page.route('**/fondo-*.mp4', (r) => r.abort())
}

test.describe('fondo en movimiento', () => {
  test('desactivado: no hay capa ni marca en el documento', async ({ page }) => {
    await simularConfig(page, { fondo_activo: false, fondo_poster_url: 'http://localhost:4173/fondo-prueba.png' })
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.dataset.fondo)).toBeUndefined()
    await expect(page.locator('div.fixed.-z-10')).toHaveCount(0)
  })

  test('activo: capa fija detrás de la página y barras translúcidas', async ({ page }) => {
    await simularConfig(page, { fondo_poster_url: 'http://localhost:4173/fondo-prueba.png', fondo_video_url: 'http://localhost:4173/fondo-pc.mp4' })
    await page.goto('/')
    const capa = page.locator('div.fixed.-z-10')
    await expect(capa).toHaveCount(1)
    expect(await capa.evaluate((e) => getComputedStyle(e).position)).toBe('fixed')
    // El video se pide cuando la página termina de cargar y el navegador queda libre (hasta unos 3 s después).
    await expect(capa.locator('video')).toHaveCount(1, { timeout: 10_000 })
    expect(await page.evaluate(() => document.documentElement.dataset.fondo)).toBe('on')
    // La capa no intercepta clics y el contenido sigue usable.
    await page.getByRole('link', { name: 'Ver catálogo' }).click()
    await expect(page).toHaveURL(/\/catalogo/)
  })

  test('con "reducir movimiento" solo se ve la imagen fija', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await simularConfig(page, { fondo_poster_url: 'http://localhost:4173/fondo-prueba.png', fondo_video_url: 'http://localhost:4173/fondo-pc.mp4' })
    await page.goto('/')
    const capa = page.locator('div.fixed.-z-10')
    await expect(capa.locator('img')).toHaveCount(1)
    await expect(capa.locator('video')).toHaveCount(0)
  })

  test('un video que no carga no rompe la tienda', async ({ page }) => {
    const errores: string[] = []
    page.on('pageerror', (e) => errores.push(e.message))
    await simularConfig(page, { fondo_video_url: 'http://localhost:4173/fondo-roto.mp4' })
    await page.goto('/catalogo')
    await expect(page.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible()
    expect(errores).toEqual([])
  })
})

import { expect, test } from '@playwright/test'

test.describe('tienda pública', () => {
  test('el inicio carga con título, hero y navegación al catálogo', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Elite Sport/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/moverte/i)
    await page.getByRole('link', { name: 'Ver catálogo' }).click()
    await expect(page).toHaveURL(/\/catalogo/)
  })

  test('los filtros del catálogo viven en la URL', async ({ page }) => {
    await page.goto('/catalogo?g=caballero&orden=precio-asc')
    await expect(page.getByRole('heading', { level: 1, name: 'Catálogo' })).toBeVisible()
    await expect(page.getByLabel('Ordenar')).toHaveValue('precio-asc')
  })

  test('el público nunca consulta el precio mayorista', async ({ page }) => {
    const consultadas: string[] = []
    page.on('request', (r) => {
      if (/precios_mayorista|obtener_precio_mayorista|precios_especiales/.test(r.url())) consultadas.push(r.url())
    })
    await page.goto('/')
    await page.goto('/catalogo')
    await page.waitForLoadState('networkidle')
    expect(consultadas).toEqual([])
  })

  test('una tienda inexistente muestra el aviso y no rompe', async ({ page }) => {
    await page.goto('/t/esta-tienda-no-existe-123')
    await expect(page.getByRole('heading', { name: /no está disponible/i })).toBeVisible()
  })

  test('el encabezado invita a solicitar ser mayorista y lleva al formulario', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('banner').getByRole('link', { name: 'Ser mayorista' }).click()
    await expect(page).toHaveURL(/\/registro/)
    await expect(page.getByRole('heading', { name: /Solicita tu cuenta/i })).toBeVisible()
  })

  test('el pie ofrece solicitar cuenta e ingresar como mayorista', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Solicitar ser mayorista' })).toBeVisible()
    await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Ingreso de mayoristas' })).toBeVisible()
  })

  test('sin scroll horizontal', async ({ page }) => {
    for (const ruta of ['/', '/catalogo', '/registro', '/ingresar']) {
      await page.goto(ruta)
      await page.waitForLoadState('networkidle')
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
      expect(sw, ruta).toBeLessThanOrEqual(cw)
    }
  })
})

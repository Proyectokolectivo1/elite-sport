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
    await expect(page.getByRole('combobox', { name: 'Ordenar' })).toContainText('menor a mayor')
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

  test('las listas desplegables usan la tipografía y los bordes de la tienda', async ({ page }) => {
    await page.goto('/catalogo')
    await page.getByRole('combobox', { name: 'Ordenar' }).click()
    const lista = page.getByRole('listbox')
    await expect(lista).toBeVisible()
    const estilo = await lista.locator('..').evaluate((e) => ({ fuente: getComputedStyle(e).fontFamily, radio: parseFloat(getComputedStyle(e).borderTopLeftRadius) }))
    expect(estilo.fuente).toContain('Inter')
    expect(estilo.radio).toBeGreaterThanOrEqual(12)
    await page.getByRole('option', { name: 'Precio: mayor a menor' }).click()
    await expect(page).toHaveURL(/orden=precio-desc/)
  })

  test('el menú separa la tienda, los mayoristas y la administración', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Abrir menú' }).click()
    const menu = page.getByRole('navigation', { name: 'Menú' })
    await expect(menu.getByRole('heading', { name: 'Comprar' })).toBeVisible()
    await expect(menu.getByRole('heading', { name: 'Mayoristas' })).toBeVisible()
    await expect(menu.getByRole('heading', { name: 'Administración' })).toBeVisible()
    await expect(menu.getByRole('link', { name: /Ingreso de mayoristas/ })).toHaveAttribute('href', '/ingresar')
    await expect(menu.getByRole('link', { name: /Ingreso del administrador/ })).toHaveAttribute('href', '/admin/login')
    await menu.getByRole('link', { name: /Solicitar ser mayorista/ }).click()
    await expect(page).toHaveURL(/\/registro/)
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

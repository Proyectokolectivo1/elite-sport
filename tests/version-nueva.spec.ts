import { expect, test } from '@playwright/test'

/**
 * Si se publica una versión nueva con la página abierta, los archivos viejos desaparecen.
 * La web no debe quedarse en negro: recarga una vez y, si sigue fallando, muestra un aviso con salida.
 */
test.describe('versión nueva publicada con la página abierta', () => {
  test('un archivo que ya no existe no deja la pantalla en negro', async ({ page }) => {
    // Como en el hosting: el archivo falta y el servidor responde con el HTML de la página.
    await page.route('**/assets/CatalogoPage-*.js', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }))
    await page.route('**/assets/ProductoPage-*.js', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }))
    await page.goto('/')
    // Recarga automática una vez (queda marcada) y después el aviso.
    await page.getByRole('link', { name: 'Catálogo', exact: true }).first().click()
    await expect(page.getByRole('heading', { name: 'Hay una versión nueva' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir al inicio' })).toBeVisible()
  })
})

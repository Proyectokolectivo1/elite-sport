import { expect, test, type Page } from '@playwright/test'

/** Carrito con un par de la tienda principal, sembrado en localStorage (no depende del stock real). */
async function sembrarCarrito(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'es-carrito',
      JSON.stringify({
        state: { porTienda: { principal: [{ varianteId: 'v-1', productoId: 'p-1', nombre: 'Runner Pro Veloz', color: 'Negro', talla: '40', imagen: null, precio: 89.9, cantidad: 2, stock: 5 }] } },
        version: 1,
      }),
    )
  })
}

test.describe('carrito y pedido por WhatsApp', () => {
  test('valida los datos del cliente y no crea el pedido si faltan', async ({ page }) => {
    let pedidos = 0
    await page.route('**/rest/v1/rpc/crear_pedido', (r) => {
      pedidos++
      return r.abort()
    })
    await sembrarCarrito(page)
    await page.goto('/')
    await page.getByRole('button', { name: /Carrito/ }).click()
    await expect(page.locator('#form-pedido').getByText('Runner Pro Veloz')).toBeVisible()
    await page.getByRole('button', { name: /Enviar pedido/ }).click()
    await expect(page.getByText('Ingresa tu nombre')).toBeVisible()
    await expect(page.getByText('Ingresa un teléfono válido')).toBeVisible()
    expect(pedidos).toBe(0)
  })

  test('guarda el pedido y abre WhatsApp con el detalle y el total', async ({ page, context }) => {
    // Respuestas simuladas: configuración con WhatsApp y el resultado de crear_pedido.
    await page.route('**/rest/v1/configuracion*', (r) =>
      r.fulfill({ json: { id: 1, nombre_negocio: 'Elite Sport', ciudad: 'Guayaquil', moneda_codigo: 'USD', moneda_simbolo: '$', moneda_decimales: 2, locale: 'es-EC', whatsapp_principal: '593991112233', actualizado_en: new Date().toISOString() } }),
    )
    let cuerpo: { p_tipo?: string; p_items?: { cantidad: number }[] } = {}
    await page.route('**/rest/v1/rpc/crear_pedido', (r) => {
      cuerpo = r.request().postDataJSON()
      return r.fulfill({ json: { id: 'ped-1', numero: 77, total: 179.8 } })
    })
    await sembrarCarrito(page)
    await page.goto('/')
    await page.getByRole('button', { name: /Carrito/ }).click()
    await page.getByLabel('Nombre').fill('Ana Pérez')
    await page.getByLabel('Teléfono').fill('0991234567')

    const popup = context.waitForEvent('page')
    await page.getByRole('button', { name: /Enviar pedido/ }).click()
    const wa = await popup
    // wa.me redirige a api.whatsapp.com: se compara número y texto sin depender de la forma exacta de la URL.
    const url = decodeURIComponent(wa.url()).replace(/\+/g, ' ')

    expect(cuerpo.p_tipo).toBe('minorista')
    expect(cuerpo.p_items?.[0].cantidad).toBe(2)
    expect(url).toMatch(/wa\.me\/593991112233|phone=593991112233/)
    expect(url).toContain('Pedido #77')
    expect(url).toContain('2 × Runner Pro Veloz · Negro · talla 40')
    expect(url).toMatch(/Total: \$179[.,]80/)
    await expect(page.getByText('#77')).toBeVisible()
  })
})

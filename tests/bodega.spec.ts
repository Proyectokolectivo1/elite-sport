import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * Panel por rol con una sesión simulada: no hay cuenta real ni se toca la base.
 * Toda llamada a Supabase se responde aquí; lo que no se simula responde vacío.
 */
type Rol = 'admin' | 'bodeguero' | 'vendedor' | 'mayorista_sector'

const REF = 'bjvwzqbvufckzlesnxzm'
const UID = '00000000-0000-4000-8000-000000000001'
const CONFIG = { id: 1, nombre_negocio: 'Elite Sport', ciudad: 'Guayaquil', moneda_codigo: 'USD', moneda_simbolo: '$', moneda_decimales: 2, locale: 'es-EC', whatsapp_principal: null, actualizado_en: new Date().toISOString() }

const linea = (id: string, extra: Record<string, number | null> = {}) => ({
  id, variante_id: `v-${id}`, descripcion: 'Runner Pro Veloz · Negro · talla 40', cantidad: 5,
  cantidad_entregada: null, cantidad_vendida: null, cantidad_devuelta: null, stock: 8, ...extra,
})
const pedido = (numero: number, estado: string, lineas: ReturnType<typeof linea>[]) => ({
  id: `ped-${numero}`, numero, tipo: 'consignacion', estado, creado_en: new Date().toISOString(),
  despachado_en: estado === 'entregado' ? new Date().toISOString() : null, liquidado_en: null, nota: null,
  solicitante_id: 'u-2', solicitante_nombre: 'Carlos Local', solicitante_rol: 'vendedor',
  cliente_nombre: 'Carlos Local', cliente_telefono: 'Sin dato', cliente_direccion: null, lineas,
})

interface Llamadas { despachar: unknown[]; cerrar: unknown[]; producto: unknown[] }

async function entrarComo(page: Page, rol: Rol): Promise<Llamadas> {
  const llamadas: Llamadas = { despachar: [], cerrar: [], producto: [] }
  await page.addInitScript(({ ref, uid }) => {
    const ahora = Math.floor(Date.now() / 1000)
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
      access_token: 'token-de-prueba', refresh_token: 'refresco-de-prueba', token_type: 'bearer',
      expires_in: 86400, expires_at: ahora + 86400,
      user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'prueba@t.test', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    }))
  }, { ref: REF, uid: UID })

  // Lo general primero: Playwright usa la última ruta registrada que coincide.
  await page.route('**/auth/v1/**', (r) => r.fulfill({ json: {} }))
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
  await page.route('**/rest/v1/configuracion*', (r) => r.fulfill({ json: CONFIG }))
  await page.route('**/rest/v1/perfiles*', (r) =>
    r.fulfill({ json: [{ id: UID, rol, estado: 'aprobado', nombre: 'Prueba', negocio: null, telefono: null, cedula_ruc: null, ciudad: null, correo: 'prueba@t.test', direccion: null, aprobado_en: null, motivo_estado: null, creado_en: new Date().toISOString() }] }),
  )
  await page.route('**/rest/v1/rpc/listar_pedidos_bodega', (r: Route) => {
    const vista = (r.request().postDataJSON() as { p_vista: string }).p_vista
    if (vista === 'por_despachar') return r.fulfill({ json: [pedido(101, 'nuevo', [linea('d1')])] })
    if (vista === 'en_poder') return r.fulfill({ json: [pedido(102, 'entregado', [linea('d2', { cantidad_entregada: 4, cantidad_vendida: 2, cantidad_devuelta: 0 })])] })
    return r.fulfill({ json: [] })
  })
  await page.route('**/rest/v1/rpc/despachar_pedido_bodega', (r) => {
    llamadas.despachar.push(r.request().postDataJSON())
    return r.fulfill({ status: 204, body: '' })
  })
  await page.route('**/rest/v1/rpc/cerrar_pedido_bodega', (r) => {
    llamadas.cerrar.push(r.request().postDataJSON())
    return r.fulfill({ json: { id: 'ped-102', venta_sin_registrar: null } })
  })
  return llamadas
}

test.describe('panel por rol', () => {
  test('el bodeguero entra a Despachos y no ve precios, ventas, mayoristas ni ajustes', async ({ page }) => {
    await entrarComo(page, 'bodeguero')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/bodega$/)
    await expect(page.getByRole('heading', { name: 'Despachos' })).toBeVisible()
    await expect(page.getByText('#101 · Carlos Local')).toBeVisible()
    for (const texto of ['Precios', 'Ventas', 'Mayoristas', 'Ajustes', 'Resumen']) {
      await expect(page.getByRole('link', { name: texto, exact: true })).toHaveCount(0)
    }
    await expect(page.locator('main')).not.toContainText('$')
  })

  test('el bodeguero no entra a pantallas de admin aunque escriba la ruta', async ({ page }) => {
    await entrarComo(page, 'bodeguero')
    for (const ruta of ['/admin/precios', '/admin/ventas', '/admin/mayoristas', '/admin/configuracion', '/admin/productos/nuevo']) {
      await page.goto(ruta)
      await expect(page, ruta).toHaveURL(/\/admin\/bodega$/)
    }
  })

  test('el bodeguero despacha lo que hay y no más de lo pedido', async ({ page }) => {
    const llamadas = await entrarComo(page, 'bodeguero')
    await page.goto('/admin/bodega')
    const campo = page.getByLabel(/Pares a entregar de Runner Pro Veloz/)
    await expect(campo).toHaveValue('5')
    await campo.fill('9')
    await expect(page.getByText('No se puede entregar más de lo pedido')).toBeVisible()
    await expect(page.getByRole('button', { name: /Despachar 9 pares/ })).toBeDisabled()
    await campo.fill('4')
    await page.getByRole('button', { name: 'Despachar 4 pares' }).click()
    await expect.poll(() => llamadas.despachar.length).toBe(1)
    expect(llamadas.despachar[0]).toEqual({ p_pedido: 'ped-101', p_lineas: [{ detalle_id: 'd1', entregados: 4 }] })
  })

  test('el cierre del día solo se guarda cuando cuadra', async ({ page }) => {
    const llamadas = await entrarComo(page, 'bodeguero')
    await page.goto('/admin/bodega/cierre')
    const vendidos = page.getByLabel(/Vendidos de Runner/)
    const regresan = page.getByLabel(/Regresan de Runner/)
    // Propuesta inicial: los 2 registrados vendidos y 2 regresan.
    await expect(vendidos).toHaveValue('2')
    await expect(regresan).toHaveValue('2')
    await regresan.fill('1')
    await expect(page.getByText('Faltan 1 por anotar')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Cerrar entrega' })).toBeDisabled()
    await vendidos.fill('3')
    await expect(regresan).toHaveValue('1')
    await expect(page.getByText(/1 par vendido que el vendedor no registró/)).toBeVisible()
    await page.getByRole('button', { name: 'Cerrar entrega' }).click()
    await expect.poll(() => llamadas.cerrar.length).toBe(1)
    expect(llamadas.cerrar[0]).toEqual({ p_pedido: 'ped-102', p_lineas: [{ detalle_id: 'd2', vendidos: 3, devueltos: 1 }] })
  })

  test('el vendedor entra a su mercancía y solo ve Mi mercancía y Vender', async ({ page }) => {
    await entrarComo(page, 'vendedor')
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/local$/)
    await expect(page.getByRole('heading', { name: 'Mi mercancía' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Vender', exact: true }).first()).toBeVisible()
    for (const texto of ['Pedidos', 'Inventario', 'Precios', 'Despachos']) {
      await expect(page.getByRole('link', { name: texto, exact: true })).toHaveCount(0)
    }
    await page.goto('/admin/bodega')
    await expect(page).toHaveURL(/\/admin\/local$/)
  })

  test('el mayorista del sector tiene su propio panel', async ({ page }) => {
    await entrarComo(page, 'mayorista_sector')
    await page.goto('/cuenta')
    await expect(page).toHaveURL(/\/sector$/)
    await expect(page.getByRole('heading', { name: 'En mi poder' })).toBeVisible()
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/sector$/)
  })
})

test.describe('fotos al crear producto', () => {
  test('al crear el producto pasa directo a la pestaña de imágenes', async ({ page }) => {
    const llamadas = await entrarComo(page, 'admin')
    const producto = { id: 'p-nuevo', nombre: 'Trail Norte', slug: 'trail-norte', grupo: 'caballero', marca_id: null, categoria_id: null, estilo_id: null, descripcion: null, precio_publico: 99, activo: true, destacado: false, creado_en: new Date().toISOString() }
    await page.route('**/rest/v1/productos*', (r) => {
      if (r.request().method() === 'POST') {
        llamadas.producto.push(r.request().postDataJSON())
        return r.fulfill({ json: { id: 'p-nuevo' } })
      }
      return r.fulfill({ json: r.request().url().includes('id=eq.p-nuevo') ? producto : [] })
    })
    await page.goto('/admin/productos/nuevo')
    await expect(page.getByRole('tab', { name: 'Imágenes' })).toBeVisible()
    await page.getByRole('tab', { name: 'Imágenes' }).click()
    await expect(page.getByText(/Primero crea el producto/)).toBeVisible()
    await page.getByLabel('Nombre').fill('Trail Norte')
    await page.getByLabel('Precio al público').fill('99')
    await page.getByRole('button', { name: 'Crear y subir fotos' }).click()
    await expect(page).toHaveURL(/\/admin\/productos\/p-nuevo$/)
    await expect(page.getByRole('tab', { name: 'Imágenes' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('Color de las fotos')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Subir fotos' })).toBeVisible()
    expect(llamadas.producto).toHaveLength(1)
  })
})

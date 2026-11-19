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
    if (vista === 'historial') {
      const cerrado = pedido(90, 'liquidado', [linea('d9', { cantidad_entregada: 6, cantidad_vendida: 5, cantidad_devuelta: 1 })])
      return r.fulfill({ json: [{ ...cerrado, solicitante_id: 'u-3', solicitante_nombre: 'Tienda Norte', solicitante_rol: 'mayorista_sector', cliente_nombre: 'Tienda Norte', liquidado_en: new Date().toISOString() }] })
    }
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

  test('sin ventanas emergentes: el éxito no muestra aviso y el error queda en una franja fija', async ({ page }) => {
    await entrarComo(page, 'bodeguero')
    await page.goto('/admin/bodega')
    await page.getByRole('button', { name: /^Despachar \d+ pares/ }).click()
    await page.waitForTimeout(500)
    await expect(page.getByRole('region', { name: 'Avisos' })).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveCount(0)
    await page.route('**/rest/v1/rpc/despachar_pedido_bodega', (r) =>
      r.fulfill({ status: 400, json: { message: 'Stock insuficiente de Runner talla 40', code: 'P0001' } }),
    )
    await page.getByRole('button', { name: /^Despachar \d+ pares/ }).click()
    const aviso = page.getByRole('alert').filter({ hasText: 'Stock insuficiente' })
    await expect(aviso).toBeVisible()
    expect(await aviso.evaluate((el) => getComputedStyle(el.closest('[aria-label="Avisos"]') as Element).position)).toBe('static')
    await page.getByRole('button', { name: 'Cerrar aviso' }).click()
    await expect(aviso).toHaveCount(0)
  })

  test('el cierre del día solo se guarda cuando cuadra', async ({ page }) => {
    const llamadas = await entrarComo(page, 'bodeguero')
    await page.goto('/admin/bodega/cierre')
    // Cada persona tiene su encabezado con lo que se le despachó en total.
    const grupo = page.getByRole('region', { name: 'Entregas de Carlos Local' })
    await expect(grupo.getByText('Vendedor del local')).toBeVisible()
    await expect(grupo.getByText(/1 entrega abierta · 4 pares despachados/)).toBeVisible()
    await expect(grupo.getByText('2 pares', { exact: true })).toBeVisible()
    await grupo.getByText('Qué se le despachó').click()
    await expect(grupo.getByText(/Despachados 4 · vendidos 2 · regresaron 0/)).toBeVisible()
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

  test('el cierre muestra quién debe cerrar y quién ya cerró hoy', async ({ page }) => {
    await entrarComo(page, 'bodeguero')
    await page.goto('/admin/bodega/cierre')
    const control = page.getByRole('region', { name: 'Control del cierre' })
    await expect(control.getByText('1 persona debe cerrar · 2 pares por cuadrar')).toBeVisible()
    await expect(control.getByText('Carlos Local')).toBeVisible()
    await expect(control.getByText(/1 entrega abierta · 2 pares en su poder/)).toBeVisible()
    // Quien ya cerró aparece aparte, con lo vendido y lo que regresó al inventario.
    await expect(control.getByText('Ya cerraron hoy')).toBeVisible()
    await expect(control.getByText('Tienda Norte')).toBeVisible()
    await expect(control.getByText('Mayorista del sector')).toBeVisible()
    await expect(control.getByText(/vendidos 5 · regresaron 1/)).toBeVisible()
    // Cada entrega abierta dice a quién pertenece.
    await expect(page.getByRole('region', { name: 'Entregas de Carlos Local' }).getByText('· Carlos Local')).toBeVisible()
    await control.getByRole('button', { name: 'Ir al cierre' }).click()
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

  const filaCobro = (numero: number, total: number, pagado: boolean, estado = 'liquidado') => ({
    id: `ped-${numero}`, numero, estado, total, nota: null, creado_en: new Date().toISOString(),
    despachado_en: new Date().toISOString(), liquidado_en: estado === 'liquidado' ? new Date().toISOString() : null,
    pagado_en: pagado ? new Date().toISOString() : null, solicitante_id: 'u-3',
    perfiles: { nombre: 'Marta Vega', negocio: 'Tienda Norte', rol: 'mayorista_sector' },
    pedidos_detalle: [{ id: `d-${numero}`, descripcion: 'Runner Pro Veloz · Negro · talla 40', cantidad: 2, cantidad_entregada: 2, cantidad_vendida: estado === 'liquidado' ? 1 : 0, cantidad_devuelta: estado === 'liquidado' ? 1 : 0, precio_unitario: 99 }],
  })

  test('el mayorista del sector ve cuánto debe pagar y qué ya pagó', async ({ page }) => {
    await entrarComo(page, 'mayorista_sector')
    await page.route('**/rest/v1/pedidos*', (r) => r.fulfill({ json: [filaCobro(70, 99, false), filaCobro(69, 150, true)] }))
    await page.goto('/sector')
    const saldo = page.getByRole('region', { name: 'Lo que debes pagar' })
    await expect(saldo.getByText('$99,00')).toBeVisible()
    await expect(saldo.getByText('1 cierre sin pagar: #70.')).toBeVisible()
    await expect(saldo.getByText('$150,00')).toBeVisible()
    await page.goto('/sector/historial')
    await expect(page.getByText('Por pagar')).toBeVisible()
    await expect(page.getByText('Pagado', { exact: true }).first()).toBeVisible()
  })

  test('el admin ve cuánto debe cada mayorista del sector y marca el pago', async ({ page }) => {
    await entrarComo(page, 'admin')
    const marcas: unknown[] = []
    await page.route('**/rest/v1/pedidos*', (r) => r.fulfill({ json: [filaCobro(70, 99, false), filaCobro(71, 40, false, 'entregado')] }))
    await page.route('**/rest/v1/rpc/marcar_pago_consignacion', (r) => {
      marcas.push(r.request().postDataJSON())
      return r.fulfill({ status: 204, body: '' })
    })
    await page.goto('/admin/cobros')
    await expect(page.getByRole('heading', { name: 'Cobros del sector' })).toBeVisible()
    const cuenta = page.getByRole('region', { name: 'Cuenta de Tienda Norte' })
    await expect(cuenta.getByText('$99,00').first()).toBeVisible()
    await expect(cuenta.getByText(/tiene en su poder/)).toBeVisible()
    await cuenta.getByRole('button', { name: 'Marcar pagado' }).click()
    await expect.poll(() => marcas.length).toBe(1)
    expect(marcas[0]).toEqual({ p_pedido: 'ped-70', p_pagado: true })
  })

  test('el bodeguero ve en el menú y en la pestaña cuántos pedidos esperan', async ({ page }) => {
    await entrarComo(page, 'bodeguero')
    await page.route('**/rest/v1/rpc/contar_pendientes_bodega', (r) => r.fulfill({ json: { por_despachar: 2, en_poder: 1, web: 1 } }))
    await page.goto('/admin/bodega')
    const menu = page.getByRole('navigation').first()
    await expect(menu.getByRole('link', { name: /^(2\s*Despachos|Despachos\s*2)$/ })).toBeVisible()
    await expect(menu.getByRole('link', { name: /^(1\s*Pedidos web|Pedidos web\s*1)$/ })).toBeVisible()
    await expect(page).toHaveTitle('(3) Elite Sport')
    // Se puede silenciar el tono; sin ventanas emergentes.
    await page.getByRole('button', { name: 'Silenciar avisos' }).click()
    await expect(page.getByRole('button', { name: 'Activar sonido de avisos' })).toBeVisible()
  })

  test('el admin ve en el menú los pedidos y mayoristas por atender', async ({ page }) => {
    await entrarComo(page, 'admin')
    await page.route('**/rest/v1/pedidos*', (r) => r.fulfill({ status: 200, headers: { 'content-range': '0-0/3', 'access-control-expose-headers': 'content-range' }, json: [] }))
    await page.goto('/admin')
    const menu = page.getByRole('navigation').first()
    await expect(menu.getByRole('link', { name: /^(3\s*Pedidos|Pedidos\s*3)$/ })).toBeVisible()
    await expect(menu.getByRole('link', { name: /^(3\s*Bodega|Bodega\s*3)$/ })).toBeVisible()
  })

  test('el vendedor reconoce cada par por su foto al vender', async ({ page }) => {
    await entrarComo(page, 'vendedor')
    await page.route('**/rest/v1/rpc/mis_pares_en_poder', (r) =>
      r.fulfill({ json: [
        { variante_id: 'v1', producto_id: 'p1', producto: 'Runner Pro Veloz', color: 'Negro', talla: '41', talla_orden: 41, en_poder: 2, precio: 89.9 },
        { variante_id: 'v2', producto_id: 'p1', producto: 'Runner Pro Veloz', color: 'Blanco', talla: '40', talla_orden: 40, en_poder: 1, precio: 89.9 },
      ] }),
    )
    const foto = (c: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${c}"/></svg>`)}`
    await page.route('**/rest/v1/imagenes_producto*', (r) =>
      r.fulfill({ json: [
        { producto_id: 'p1', color: 'Negro', url: foto('black'), url_miniatura: foto('black'), orden: 0 },
        { producto_id: 'p1', color: 'Blanco', url: foto('white'), url_miniatura: foto('white'), orden: 1 },
      ] }),
    )
    await page.goto('/admin/local/vender')
    const negro = page.getByRole('article', { name: 'Runner Pro Veloz, Negro' })
    await expect(negro.getByRole('img', { name: 'Runner Pro Veloz Negro' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Runner Pro Veloz, Blanco' }).getByRole('img', { name: 'Runner Pro Veloz Blanco' })).toBeVisible()
    // La foto de la talla elegida acompaña a la línea de la venta.
    await negro.getByRole('button', { name: /talla 41, quedan 2/ }).click()
    await expect(page.getByRole('complementary', { name: 'Venta actual' }).locator('img')).toHaveCount(1)
    const caja = await negro.getByRole('img').boundingBox()
    expect(caja && caja.width >= 120).toBe(true)
  })

  test('el admin crea una cuenta con acceso y recibe los datos para entregarlos', async ({ page }) => {
    await entrarComo(page, 'admin')
    const cuerpos: Record<string, unknown>[] = []
    await page.route('**/functions/v1/gestionar-usuarios', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      cuerpos.push(r.request().postDataJSON())
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, json: { ok: true, id: 'u-nuevo' } })
    })
    await page.goto('/admin/equipo')
    await page.getByRole('button', { name: 'Nuevo usuario' }).click()
    await page.getByRole('button', { name: 'Crear cuenta con acceso' }).click()
    await expect(page.getByText('Ingresa el nombre')).toBeVisible()
    expect(cuerpos).toHaveLength(0)
    await page.getByLabel('Nombre completo').fill('Carlos Bodega')
    await page.getByLabel('Correo (será su usuario)').fill('carlos@correo.com')
    const clave = await page.getByLabel('Contraseña temporal').inputValue()
    expect(clave).toHaveLength(10)
    await page.getByRole('button', { name: 'Crear cuenta con acceso' }).click()
    await expect.poll(() => cuerpos.length).toBe(1)
    expect(cuerpos[0]).toMatchObject({ accion: 'crear', correo: 'carlos@correo.com', rol: 'bodeguero', estado: 'aprobado', contrasena: clave })
    const aviso = page.getByRole('status').filter({ hasText: 'Cuenta creada y aprobada' })
    await expect(aviso).toBeVisible()
    await expect(page.getByText(clave, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copiar mensaje completo' })).toBeVisible()
  })

  test('si la función rechaza el alta, el motivo se muestra en el formulario', async ({ page }) => {
    await entrarComo(page, 'admin')
    await page.route('**/functions/v1/gestionar-usuarios', (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
      return r.fulfill({ status: 409, headers: { 'access-control-allow-origin': '*' }, json: { error: 'Ese correo ya tiene una cuenta.' } })
    })
    await page.goto('/admin/equipo')
    await page.getByRole('button', { name: 'Nuevo usuario' }).click()
    await page.getByLabel('Nombre completo').fill('Ana')
    await page.getByLabel('Correo (será su usuario)').fill('ana@correo.com')
    await page.getByRole('button', { name: 'Crear cuenta con acceso' }).click()
    await expect(page.getByText('Ese correo ya tiene una cuenta.')).toBeVisible()
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
    const op = (t: string) => [{ id: `id-${t}`, nombre: t, slug: t }]
    await page.route('**/rest/v1/marcas*', (r) => r.fulfill({ json: op('Adidas') }))
    await page.route('**/rest/v1/categorias*', (r) => r.fulfill({ json: op('Running') }))
    await page.route('**/rest/v1/estilos*', (r) => r.fulfill({ json: op('Deportivo') }))
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
    // Sin producto creado, la pestaña no cambia y sigue la guía de la página.
    await expect(page.getByRole('tab', { name: 'Datos y precios' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText(/Crear y subir fotos/).first()).toBeVisible()
    await page.getByLabel('Nombre').fill('Trail Norte')
    // Marca, categoría y estilo se eligen con la lista propia: su valor debe llegar al formulario.
    await page.getByRole('combobox', { name: 'Marca' }).click()
    await page.getByRole('option', { name: 'Adidas' }).click()
    await page.getByRole('combobox', { name: 'Categoría' }).click()
    await page.getByRole('option', { name: 'Running' }).click()
    await page.getByRole('combobox', { name: 'Estilo' }).click()
    await page.getByRole('option', { name: 'Deportivo' }).click()
    await page.getByLabel('Precio al público').fill('99')
    await page.getByLabel('Precio mayorista').fill('60')
    await page.getByRole('button', { name: 'Crear y subir fotos' }).click()
    await expect(page).toHaveURL(/\/admin\/productos\/p-nuevo$/)
    await expect(page.getByRole('tab', { name: 'Imágenes' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('Color de las fotos')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Subir fotos' })).toBeVisible()
    expect(llamadas.producto).toHaveLength(1)
    expect(llamadas.producto[0]).toMatchObject({ marca_id: 'id-Adidas', categoria_id: 'id-Running', estilo_id: 'id-Deportivo' })
  })
})

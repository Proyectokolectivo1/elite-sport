import { expect, test } from '@playwright/test'

const REF = 'bjvwzqbvufckzlesnxzm'
const UID = '00000000-0000-4000-8000-000000000009'

test.describe('recuperación de contraseña', () => {
  test('el ingreso ofrece recuperar la contraseña', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(page).toHaveURL(/\/recuperar$/)
    await page.goto('/admin/login')
    await expect(page.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toBeVisible()
  })

  test('valida el correo y envía el enlace con el destino correcto', async ({ page }) => {
    const pedidos: { url: string; cuerpo: { email?: string } }[] = []
    await page.route('**/auth/v1/recover*', (r) => {
      pedidos.push({ url: r.request().url(), cuerpo: r.request().postDataJSON() })
      return r.fulfill({ json: {} })
    })
    await page.goto('/recuperar')
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByText('Ingresa tu correo')).toBeVisible()
    expect(pedidos).toHaveLength(0)
    await page.getByLabel('Correo').fill('ana@correo.com')
    await page.getByRole('button', { name: 'Enviar enlace' }).click()
    await expect(page.getByRole('status')).toContainText('ana@correo.com')
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0].cuerpo.email).toBe('ana@correo.com')
    expect(decodeURIComponent(pedidos[0].url)).toContain('/nueva-contrasena')
  })

  test('sin sesión de recuperación el enlace se muestra como no válido', async ({ page }) => {
    await page.goto('/nueva-contrasena')
    await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible()
    await page.getByRole('link', { name: 'Pedir un enlace nuevo' }).click()
    await expect(page).toHaveURL(/\/recuperar$/)
  })

  test('con la sesión del enlace valida y guarda la contraseña nueva', async ({ page }) => {
    await page.addInitScript(({ ref, uid }) => {
      const t = Math.floor(Date.now() / 1000)
      localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
        access_token: 'token-de-prueba', refresh_token: 'refresco-de-prueba', token_type: 'bearer', expires_in: 86400, expires_at: t + 86400,
        user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'ana@correo.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      }))
    }, { ref: REF, uid: UID })
    await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
    let cuerpo: { password?: string } = {}
    let llamadas = 0
    await page.route('**/auth/v1/user*', (r) => {
      if (r.request().method() !== 'PUT') return r.fulfill({ json: { id: UID, email: 'ana@correo.com' } })
      llamadas++
      cuerpo = r.request().postDataJSON()
      return r.fulfill({ json: { id: UID, email: 'ana@correo.com' } })
    })
    await page.goto('/nueva-contrasena')
    await page.getByLabel('Contraseña nueva').fill('corta')
    await page.getByLabel('Repite la contraseña').fill('otra')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect(page.getByText('Mínimo 8 caracteres')).toBeVisible()
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()
    expect(llamadas).toBe(0)
    await page.getByLabel('Contraseña nueva').fill('ClaveNueva2026')
    await page.getByLabel('Repite la contraseña').fill('ClaveNueva2026')
    await page.getByRole('button', { name: 'Guardar contraseña' }).click()
    await expect.poll(() => llamadas).toBe(1)
    expect(cuerpo.password).toBe('ClaveNueva2026')
    await expect(page).toHaveURL(/\/cuenta$/)
  })
})

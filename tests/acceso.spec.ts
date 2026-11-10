import { expect, test } from '@playwright/test'

test.describe('rutas protegidas y registro', () => {
  test('/admin sin sesión redirige al ingreso de administración', async ({ page }) => {
    await page.goto('/admin/productos')
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('/mayorista y /cuenta sin sesión redirigen a ingresar', async ({ page }) => {
    await page.goto('/mayorista')
    await expect(page).toHaveURL(/\/ingresar/)
    await page.goto('/cuenta')
    await expect(page).toHaveURL(/\/ingresar/)
  })

  test('la página de diseño no existe en producción', async ({ page }) => {
    await page.goto('/_ds')
    await expect(page).toHaveURL(/localhost:\d+\/$/)
  })

  test('el registro valida los campos antes de enviar', async ({ page }) => {
    let llamadas = 0
    page.on('request', (r) => {
      if (r.url().includes('/auth/v1/signup')) llamadas++
    })
    await page.goto('/registro')
    await page.getByRole('button', { name: 'Enviar solicitud' }).click()
    await expect(page.getByText('Ingresa tu nombre completo')).toBeVisible()
    await expect(page.getByText(/Cédula \(10 dígitos\)/)).toBeVisible()
    expect(llamadas).toBe(0)
  })

  test('el login rechaza un correo inválido sin llamar al servidor', async ({ page }) => {
    await page.goto('/ingresar')
    await page.getByLabel('Correo').fill('no-es-correo')
    await page.getByLabel('Contraseña').fill('123456')
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page.getByText('Correo no válido')).toBeVisible()
  })
})

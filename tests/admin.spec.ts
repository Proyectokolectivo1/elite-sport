import { expect, test } from '@playwright/test'

/**
 * Recorrido del administrador con la cuenta real. No corre sin credenciales:
 *   E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 * y no modifica datos salvo que además se defina E2E_MUTATE=1.
 */
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test.describe('administrador', () => {
  test.skip(!email || !password, 'Define E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD para correr este recorrido.')

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
    await page.getByLabel('Correo').fill(email as string)
    await page.getByLabel('Contraseña').fill(password as string)
    await page.getByRole('button', { name: 'Ingresar' }).click()
    await expect(page).toHaveURL(/\/admin$/)
  })

  test('la vista previa de la caja convierte pares por talla a unidades', async ({ page }) => {
    await page.goto('/admin/inventario?tab=ingreso')
    await page.getByLabel('Producto').selectOption({ index: 1 })
    await page.getByLabel('Número de cajas').fill('2')
    await page.getByLabel('Pares por caja, talla 35').fill('3')
    await expect(page.getByLabel('Total, talla 35')).toHaveValue('6')
  })

  test('el ingreso por caja suma al stock y queda en movimientos', async ({ page }) => {
    test.skip(!process.env.E2E_MUTATE, 'Modifica datos: define E2E_MUTATE=1 para correrlo.')
    await page.goto('/admin/inventario?tab=ingreso')
    await page.getByLabel('Producto').selectOption({ index: 1 })
    await page.getByLabel('Color').fill('Prueba E2E')
    await page.getByLabel('Número de cajas').fill('2')
    await page.getByLabel(/Surtido de la caja/).selectOption({ index: 1 })
    await page.getByRole('button', { name: /^Ingresar \d+ pares/ }).click()
    await expect(page.getByText(/Ingresaron \d+ pares/)).toBeVisible()
    await page.goto('/admin/inventario?tab=movimientos')
    await expect(page.getByText('Ingreso').first()).toBeVisible()
  })
})

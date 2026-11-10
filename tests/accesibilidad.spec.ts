import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const RUTAS = ['/', '/catalogo', '/registro', '/ingresar', '/admin/login']

for (const ruta of RUTAS) {
  test(`accesibilidad sin violaciones serias: ${ruta}`, async ({ page }) => {
    await page.goto(ruta)
    await page.waitForLoadState('networkidle')
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(graves.map((v) => `${v.id}: ${v.nodes.length} nodo(s): ${v.help}`)).toEqual([])
  })
}

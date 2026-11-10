import { defineConfig, devices } from '@playwright/test'

const PUERTO = 4173

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PUERTO}`, trace: 'retain-on-failure', channel: 'chrome' },
  // Se prueba la versión de producción (build + preview), igual que en Vercel.
  webServer: {
    command: `npx tsc -b && npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'movil-375', use: { ...devices['Pixel 5'], viewport: { width: 375, height: 812 } } },
    { name: 'escritorio-1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
})

import { availableParallelism, freemem } from 'node:os'
import { defineConfig, devices } from '@playwright/test'

// Puerto propio para no chocar con el 5173 de un servidor de desarrollo abierto.
const puerto = 5199

// La mitad de los hilos, el valor de Playwright, satura una PC de 16 GB: se abren los navegadores que entran en la RAM
// libre al arrancar (0,75 GB cada uno, 1 GB para el sistema), no más de un cuarto de los hilos. --workers sigue mandando.
const GB = 2 ** 30
const navegadores = Math.max(
  1,
  Math.min(Math.floor((freemem() - GB) / (0.75 * GB)), Math.floor(availableParallelism() / 4)),
)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: navegadores,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${puerto}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${puerto} --strictPort`,
    url: `http://localhost:${puerto}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})

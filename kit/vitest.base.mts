type Opciones = { entorno?: 'node' | 'jsdom'; setup?: string[] }

/**
 * Base de Vitest del kit. Un perfil la extiende con su entorno (`jsdom` en frontend, `node` en el
 * backend) y sus archivos de setup; los tests viven junto al código, nunca en snapshots de markup.
 */
export function vitestBase({ entorno = 'node', setup = [] }: Opciones = {}) {
  return {
    test: {
      environment: entorno,
      setupFiles: setup,
      include: ['src/**/*.test.{ts,tsx,mts}'],
      css: false,
      passWithNoTests: false,
    },
  }
}

import { defineConfig } from 'eslint/config'

import { baseTypeScript, formatoAlFinal } from './kit/eslint.base.mjs'
import { perfilFrontend } from './kit/eslint.frontend.mjs'
import { reglasDeOficio } from './kit/eslint.oficio.mjs'
import { reglasPropias } from './kit/eslint.reglas-propias.mjs'
import { guardTailwind } from './kit/eslint.tailwind-guard.mjs'

export default defineConfig([
  ...baseTypeScript({ tsconfigRootDir: import.meta.dirname }),
  ...perfilFrontend(),
  ...reglasDeOficio(),
  ...guardTailwind({ activo: false }),
  reglasPropias({ archivoReloj: 'src/motor/reloj.ts' }),
  formatoAlFinal,
])

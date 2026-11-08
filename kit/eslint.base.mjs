import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export const ignoradosBase = ['dist/**', 'coverage/**', 'node_modules/**', '**/*.generado.*']

/**
 * Base compartida de lint para todo TypeScript del kit: análisis con información de tipos
 * (`projectService`), preset `recommendedTypeChecked` y reglas sumadas una por una porque detectan
 * defectos que el compilador estricto no ve. `formatoAlFinal` va siempre último en el proyecto.
 */
export function baseTypeScript({
  tsconfigRootDir,
  archivos = ['**/*.{ts,tsx,mts,cts}'],
  ignorados = [],
} = {}) {
  return defineConfig([
    globalIgnores([...ignoradosBase, ...ignorados]),
    {
      files: archivos,
      extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
      languageOptions: { parserOptions: { projectService: true, tsconfigRootDir } },
      rules: {
        '@typescript-eslint/switch-exhaustiveness-check': 'error',
        'no-nested-ternary': 'error',
        complexity: ['error', { max: 15 }],
        eqeqeq: ['error', 'always'],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
  ])
}

export const formatoAlFinal = prettier

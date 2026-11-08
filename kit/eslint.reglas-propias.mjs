// Plugin local con las reglas propias del proyecto, sin paquete nuevo. Agregar una regla es sumar una
// entrada a `reglas` y su nombre a `REGLAS_ACTIVAS`; la que viene es el ejemplo.

const reglas = {
  'hora-desde-el-reloj': {
    meta: {
      type: 'problem',
      schema: [],
      messages: {
        horaDirecta:
          'No leas la hora directamente: tomala del módulo de reloj del proyecto, así los tests la fijan.',
      },
    },
    create(contexto) {
      return {
        CallExpression(nodo) {
          const { callee } = nodo
          if (
            callee.type === 'MemberExpression' &&
            callee.object.type === 'Identifier' &&
            callee.object.name === 'Date' &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'now'
          ) {
            contexto.report({ node: nodo, messageId: 'horaDirecta' })
          }
        },
        NewExpression(nodo) {
          if (
            nodo.callee.type === 'Identifier' &&
            nodo.callee.name === 'Date' &&
            nodo.arguments.length === 0
          ) {
            contexto.report({ node: nodo, messageId: 'horaDirecta' })
          }
        },
      }
    },
  },
}

const REGLAS_ACTIVAS = ['hora-desde-el-reloj']

// Bloque de configuración para `eslint.config.mjs`, entre los bloques del perfil y `formatoAlFinal`.
// `archivoReloj` es el módulo de reloj del proyecto: el único que puede leer la hora directamente.
export function reglasPropias({
  archivos = ['**/*.{ts,tsx,mts}'],
  archivoReloj = 'src/reloj.ts',
} = {}) {
  return {
    files: archivos,
    ignores: [archivoReloj],
    plugins: { propias: { rules: reglas } },
    rules: Object.fromEntries(REGLAS_ACTIVAS.map((nombre) => [`propias/${nombre}`, 'error'])),
  }
}

import query from '@tanstack/eslint-plugin-query'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig } from 'eslint/config'

export const primitivasUi = ['@base-ui/react', '@base-ui/react/*', 'cmdk']

// Claves propias de un objeto de ruta de React Router: delatan una ruta aunque no llegue directo a la
// llamada que arma el router. `children`, `index`, `id` y `caseSensitive` solas no alcanzan: un menú,
// un árbol de archivos o el patrón de `matchPath` también las usan.
const CLAVES_DE_RUTA = new Set([
  'element',
  'Component',
  'errorElement',
  'ErrorBoundary',
  'HydrateFallback',
  'hydrateFallbackElement',
])
// Claves que una ruta lleva con una función: delatan una ruta sólo con ese valor. Con un texto, un
// enum o una variable de texto son de otra cosa, como un evento de analítica (`action: 'page_view'`)
// o un permiso. `middleware` lleva una lista de funciones y `handle`, un objeto escrito ahí: un
// `handle` en una variable puede ser el de un archivo.
const CLAVES_DE_RUTA_CON_FUNCION = new Set(['lazy', 'loader', 'action', 'shouldRevalidate'])
const FUNCIONES_ESCRITAS = new Set(['ArrowFunctionExpression', 'FunctionExpression'])
// Envoltorios de TypeScript que no cambian el valor: `lista as RouteObject[]`, `satisfies`, `lista!`.
const ENVOLTORIOS_TS = new Set(['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression'])
// Llamadas que reciben la lista de rutas: todo objeto de esa lista, y de sus `children`, es una ruta.
const LLAMADAS_DE_ROUTER = new Set([
  'createBrowserRouter',
  'createHashRouter',
  'createMemoryRouter',
  'createStaticRouter',
  'useRoutes',
])
const PAQUETES_DE_ROUTER = new Set(['react-router', 'react-router-dom'])

const nombreDeClave = (propiedad) =>
  propiedad.type === 'Property' && !propiedad.computed
    ? propiedad.key.type === 'Identifier'
      ? propiedad.key.name
      : propiedad.key.value
    : undefined

const nombreLlamado = (callee) =>
  callee.type === 'Identifier'
    ? callee.name
    : callee.type === 'MemberExpression' && !callee.computed
      ? callee.property.name
      : undefined

// El chequeo del mapa lee las rutas de pantalla de un módulo de datos; esta regla obliga al router a
// tomarlas de ahí: fuera de ese módulo, un objeto de ruta no escribe `path` (lo trae del módulo con
// `...ruta`) y la forma JSX `<Route path>` no se usa, porque no puede atarse a la lista.
const pluginRutas = {
  rules: {
    'rutas-desde-la-lista': {
      meta: {
        type: 'problem',
        schema: [{ type: 'object', properties: { modulo: { type: 'string' } } }],
        messages: {
          rutaPropia:
            'Declará la ruta en {{modulo}} y armá el router desde esa lista con `...ruta`: el mapa de funcionalidades la lee de ahí.',
          rutaJsx:
            'Armá el router con objetos tomados de {{modulo}}: una ruta JSX no se puede atar a la lista que lee el mapa de funcionalidades.',
        },
      },
      create(contexto) {
        const modulo = contexto.options[0]?.modulo ?? 'src/rutas.ts'
        const reportados = new Set()
        const nombresDeRoute = new Set()
        const espaciosDelRouter = new Set()
        const reportarPath = (objeto) => {
          const path = objeto.properties.find((propiedad) => nombreDeClave(propiedad) === 'path')
          if (path && !reportados.has(path)) {
            reportados.add(path)
            contexto.report({ node: path, messageId: 'rutaPropia', data: { modulo } })
          }
        }
        // Lleva un valor a lo que escribe: quita los envoltorios de TypeScript y sigue una constante
        // hasta su valor inicial, como `const routes: RouteObject[] = [...]; createBrowserRouter(routes)`.
        // Una función escrita ahí, o un nombre cuyo tipo se puede llamar (`loader: cargarExpediente`).
        // Sin tipos, un nombre cuenta como función: mejor un aviso de más que una ruta que se escapa.
        const servicios = contexto.sourceCode.parserServices
        const esFuncion = (valor) => {
          if (FUNCIONES_ESCRITAS.has(valor.type)) return true
          if (valor.type !== 'Identifier' && valor.type !== 'MemberExpression') return false
          if (valor.type === 'Identifier' && valor.name === 'undefined') return false
          if (!servicios?.program) return true
          return servicios.getTypeAtLocation(valor).getCallSignatures().length > 0
        }
        const delataRuta = (propiedad) => {
          const clave = nombreDeClave(propiedad)
          if (CLAVES_DE_RUTA.has(clave)) return true
          const valor = propiedad.value
          // `lazy` también acepta un objeto con sus partes (`lazy: { Component }`).
          if (clave === 'lazy' && valor.type === 'ObjectExpression') return true
          if (CLAVES_DE_RUTA_CON_FUNCION.has(clave)) return esFuncion(valor)
          if (clave === 'middleware') return valor.type === 'ArrayExpression'
          if (clave === 'handle') return valor.type === 'ObjectExpression'
          return false
        }
        const resolver = (valor) => {
          const vistos = new Set()
          let actual = valor
          while (actual) {
            if (ENVOLTORIOS_TS.has(actual.type)) {
              actual = actual.expression
            } else if (actual.type === 'Identifier' && !vistos.has(actual.name)) {
              vistos.add(actual.name)
              let ambito = contexto.sourceCode.getScope(actual)
              let variable
              while (ambito && !variable) {
                variable = ambito.set.get(actual.name)
                ambito = ambito.upper
              }
              const definicion = variable?.defs[0]
              if (
                definicion?.type !== 'Variable' ||
                definicion.parent.kind !== 'const' ||
                !definicion.node.init
              ) {
                return actual
              }
              actual = definicion.node.init
            } else {
              return actual
            }
          }
          return actual
        }
        // Recorre la lista que recibe el router y la de cada `children`.
        const recorrerLista = (valor) => {
          const lista = resolver(valor)
          if (lista?.type !== 'ArrayExpression') return
          for (const elemento of lista.elements) {
            // Un grupo de rutas que se suma con `...rutasAdmin` se recorre como una lista más.
            if (elemento?.type === 'SpreadElement') {
              recorrerLista(elemento.argument)
              continue
            }
            const objeto = elemento && resolver(elemento)
            if (objeto?.type !== 'ObjectExpression') continue
            reportarPath(objeto)
            const hijos = objeto.properties.find(
              (propiedad) => nombreDeClave(propiedad) === 'children',
            )
            if (hijos) recorrerLista(hijos.value)
          }
        }
        return {
          ImportDeclaration(nodo) {
            if (!PAQUETES_DE_ROUTER.has(nodo.source.value)) return
            for (const especificador of nodo.specifiers) {
              if (
                especificador.type === 'ImportSpecifier' &&
                especificador.imported.name === 'Route'
              ) {
                nombresDeRoute.add(especificador.local.name)
              } else if (especificador.type !== 'ImportSpecifier') {
                espaciosDelRouter.add(especificador.local.name)
              }
            }
          },
          CallExpression(nodo) {
            if (LLAMADAS_DE_ROUTER.has(nombreLlamado(nodo.callee))) recorrerLista(nodo.arguments[0])
          },
          ObjectExpression(nodo) {
            if (nodo.properties.some(delataRuta)) {
              reportarPath(nodo)
            }
          },
          JSXOpeningElement(nodo) {
            const { name: nombre } = nodo
            const esRoute =
              (nombre.type === 'JSXIdentifier' && nombresDeRoute.has(nombre.name)) ||
              (nombre.type === 'JSXMemberExpression' &&
                nombre.object.type === 'JSXIdentifier' &&
                espaciosDelRouter.has(nombre.object.name) &&
                nombre.property.name === 'Route')
            if (esRoute) contexto.report({ node: nodo, messageId: 'rutaJsx', data: { modulo } })
          },
        }
      },
    },
  },
}

/**
 * Perfil frontend del kit: se suma a `baseTypeScript` y antes de `formatoAlFinal`.
 * Reglas de hooks y de refresh de React, plugin oficial de TanStack Query, la regla de capas
 * (las primitivas sólo se importan desde la capa de interfaz aprobada) y la de rutas: el router
 * toma cada ruta de pantalla del módulo `rutas`, el mismo que lee el chequeo del mapa.
 * `eslint-plugin-jsx-a11y` no entra mientras declare `eslint <= 9` (6.10.2, 2024-10): la
 * accesibilidad se verifica con axe por estado en el circuito de entrega y con revisión.
 */
export function perfilFrontend({
  archivos = ['src/**/*.{ts,tsx}'],
  capaUi = 'src/components/ui/**',
  primitivas = primitivasUi,
  rutas = 'src/rutas.ts',
} = {}) {
  return defineConfig([
    {
      files: archivos,
      ignores: [rutas],
      plugins: { 'kit-rutas': pluginRutas },
      rules: { 'kit-rutas/rutas-desde-la-lista': ['error', { modulo: rutas }] },
    },
    {
      files: archivos,
      extends: [
        reactHooks.configs.flat.recommended,
        reactRefresh.configs.vite,
        ...query.configs['flat/recommended'],
      ],
    },
    {
      files: archivos,
      ignores: [capaUi],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: primitivas,
                message: `Primitivas solo en ${capaUi.replace('/**', '')}. Usar el componente aprobado de @/components/ui/*.`,
              },
            ],
          },
        ],
      },
    },
    {
      files: [capaUi],
      rules: {
        'react-refresh/only-export-components': 'off',
      },
    },
  ])
}

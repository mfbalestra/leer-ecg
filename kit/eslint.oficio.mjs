import { defineConfig } from 'eslint/config'

// Plugin local de reglas de oficio visual (skill implementar-interfaz, dirección visual): clichés que
// se ven en clases literales de className y en llamadas a cn/cva/clsx, sin paquete nuevo. No ve
// clases armadas en tiempo de ejecución, CSS externo ni @apply: eso sigue cubierto por la guardia en
// el navegador (medir-oficio.js/oficio.ts) y por la inspección.

const NOMBRES_CN = new Set(['cn', 'cva', 'clsx'])
const RE_DEGRADADO = /^bg-(?:gradient-|linear-|radial|conic)/
const RE_FOCO_VISIBLE = /\b(?:focus-visible|focus-within|focus|data-highlighted|data-selected):/
const RE_BARRA_OCULTA_ARBITRARIA = /^\[\s*scrollbar-width\s*:\s*none\s*\]$/
const RE_EMOJI = /\p{Extended_Pictographic}/u

const REGLAS_SIEMPRE = ['sin-emoji-como-icono', 'sin-foco-oculto', 'sin-barra-oculta']
// Decisiones de gusto: son preguntas de revisión (skill implementar-interfaz, clichés de la dirección visual) y sólo se activan cuando
// el DESIGN.md del proyecto las prohíbe y la configuración las pasa en `adoptadas`.
const REGLAS_ADOPTABLES = ['sin-texto-degradado', 'sin-borde-lateral-de-color']
const REGLAS_CLICHE = [...REGLAS_ADOPTABLES, ...REGLAS_SIEMPRE]

function esNombrePlugin(callee) {
  return callee?.type === 'Identifier' && NOMBRES_CN.has(callee.name)
}

// Junta cada string literal que compone un className o una llamada a cn/cva/clsx, atravesando
// arreglos, objetos (clave y valor), condicionales y llamadas anidadas a la misma familia.
function recolectarTextos(nodo, salida) {
  if (!nodo) return
  switch (nodo.type) {
    case 'Literal':
      if (typeof nodo.value === 'string') salida.push({ texto: nodo.value, nodo })
      return
    case 'TemplateLiteral':
      for (const cuasi of nodo.quasis) {
        const texto = cuasi.value.cooked ?? cuasi.value.raw
        if (texto) salida.push({ texto, nodo: cuasi })
      }
      for (const expresion of nodo.expressions) recolectarTextos(expresion, salida)
      return
    case 'JSXExpressionContainer':
      recolectarTextos(nodo.expression, salida)
      return
    case 'ArrayExpression':
      for (const elemento of nodo.elements) if (elemento) recolectarTextos(elemento, salida)
      return
    case 'SpreadElement':
      recolectarTextos(nodo.argument, salida)
      return
    case 'ObjectExpression':
      for (const propiedad of nodo.properties) {
        if (propiedad.type === 'SpreadElement') {
          recolectarTextos(propiedad.argument, salida)
          continue
        }
        if (propiedad.type !== 'Property') continue
        if (!propiedad.computed) {
          const clave = propiedad.key
          if (clave.type === 'Identifier') salida.push({ texto: clave.name, nodo: clave })
          else if (clave.type === 'Literal' && typeof clave.value === 'string')
            salida.push({ texto: clave.value, nodo: clave })
        }
        recolectarTextos(propiedad.value, salida)
      }
      return
    case 'ConditionalExpression':
      recolectarTextos(nodo.consequent, salida)
      recolectarTextos(nodo.alternate, salida)
      return
    case 'LogicalExpression':
      recolectarTextos(nodo.left, salida)
      recolectarTextos(nodo.right, salida)
      return
    case 'CallExpression':
      if (esNombrePlugin(nodo.callee))
        for (const argumento of nodo.arguments) recolectarTextos(argumento, salida)
      return
    default:
      return
  }
}

// Evita procesar dos veces el mismo conjunto: una llamada a cn/cva/clsx anidada dentro de un
// className o de otra llamada ya la recolecta su contenedor.
function esRaizDeConjunto(nodo) {
  let actual = nodo.parent
  while (actual) {
    if (actual.type === 'JSXAttribute' && actual.name?.name === 'className') return false
    if (actual.type === 'CallExpression' && esNombrePlugin(actual.callee)) return false
    actual = actual.parent
  }
  return true
}

function analizarAnchoLateral(clase) {
  const m = /^border-([lrse])-(.+)$/.exec(clase)
  if (!m) return false
  const sufijo = m[2]
  if (/^\d+$/.test(sufijo)) return sufijo !== '0'
  const arbitrario = /^\[(.+)\]$/.exec(sufijo)
  if (arbitrario) return arbitrario[1].trim().toLowerCase().replace(/\s+/g, '') !== '1px'
  return false
}

const LADOS_SIN_COLOR = new Set([
  'border-t',
  'border-b',
  'border-l',
  'border-r',
  'border-x',
  'border-y',
  'border-s',
  'border-e',
])

function esClaseColorDeBorde(clase) {
  if (clase === 'border' || LADOS_SIN_COLOR.has(clase)) return false
  const m = /^border(?:-[tblrsexy])?-(.+)$/.exec(clase)
  if (!m) return false
  const resto = m[1]
  if (/^\d+$/.test(resto)) return false
  if (/^\[.*\]$/.test(resto)) return false
  return true
}

function evaluarTextoDegradado(clases) {
  if (!clases.includes('bg-clip-text')) return null
  const degradado = clases.find((c) => RE_DEGRADADO.test(c))
  if (!degradado) return null
  return {
    clase: degradado,
    mensaje: `Texto con degradado ("bg-clip-text" junto a "${degradado}"): el DESIGN.md del proyecto lo prohíbe. Si es intencional, registrá el desvío en reglasDeOficio() (skill nuevo-proyecto) o "// eslint-disable-next-line oficio/sin-texto-degradado -- <motivo>".`,
  }
}

function evaluarBordeLateralDeColor(clases) {
  const lateral = clases.find((c) => analizarAnchoLateral(c))
  if (!lateral) return null
  const color = clases.find((c) => esClaseColorDeBorde(c))
  if (!color) return null
  return {
    clase: lateral,
    mensaje: `Borde lateral de color ("${lateral}" junto a "${color}"): el DESIGN.md del proyecto lo prohíbe. Registrá el desvío en reglasDeOficio() o "// eslint-disable-next-line oficio/sin-borde-lateral-de-color -- <motivo>".`,
  }
}

function evaluarFocoOculto(clases) {
  const oculto = clases.find((c) => c === 'outline-none' || c === 'outline-hidden')
  if (!oculto) return null
  if (RE_FOCO_VISIBLE.test(clases.join(' '))) return null
  return {
    clase: oculto,
    mensaje: `"${oculto}" sin reemplazo visible de foco (focus-visible:, focus:, focus-within:, data-highlighted: o data-selected:): cliché de oficio visual. Agregá el reemplazo o registrá el desvío ("// eslint-disable-next-line oficio/sin-foco-oculto -- <motivo>").`,
  }
}

function evaluarBarraOculta(clases) {
  const oculta = clases.find(
    (c) =>
      c === 'no-scrollbar' ||
      c === 'scrollbar-none' ||
      c === 'scrollbar-hide' ||
      RE_BARRA_OCULTA_ARBITRARIA.test(c),
  )
  if (!oculta) return null
  return {
    clase: oculta,
    mensaje: `"${oculta}" oculta la barra de desplazamiento: cliché de oficio visual. Quitala o registrá el desvío ("// eslint-disable-next-line oficio/sin-barra-oculta -- <motivo>").`,
  }
}

function reglaDeConjunto(evaluar) {
  return {
    meta: { type: 'problem', schema: [] },
    create(context) {
      function procesar(nodoPorDefecto, textos) {
        const clases = []
        for (const { texto, nodo } of textos) {
          for (const clase of texto.split(/\s+/).filter(Boolean)) clases.push({ clase, nodo })
        }
        const hallazgo = evaluar(clases.map((c) => c.clase))
        if (!hallazgo) return
        // Se informa en el nodo raíz del conjunto (el atributo o la llamada), no en el token de la
        // clase: así un "eslint-disable-next-line" puesto sobre el atributo cubre el hallazgo aunque
        // la clase viva más abajo, dentro de una cadena partida en varias líneas.
        context.report({ node: nodoPorDefecto, message: hallazgo.mensaje })
      }
      return {
        'JSXAttribute[name.name="className"]'(nodo) {
          const textos = []
          recolectarTextos(nodo.value, textos)
          procesar(nodo, textos)
        },
        CallExpression(nodo) {
          if (!esNombrePlugin(nodo.callee) || !esRaizDeConjunto(nodo)) return
          const textos = []
          recolectarTextos(nodo, textos)
          procesar(nodo, textos)
        },
      }
    },
  }
}

function reglaSinEmojiComoIcono() {
  return {
    meta: { type: 'problem', schema: [] },
    create(context) {
      function revisar(nodo, texto) {
        if (RE_EMOJI.test(texto)) {
          context.report({
            node: nodo,
            message: `Emoji como ícono en JSX ("${texto.trim()}"): cliché de oficio visual. Usá un ícono del sistema (lucide-react) o registrá el desvío ("// eslint-disable-next-line oficio/sin-emoji-como-icono -- <motivo>").`,
          })
        }
      }
      return {
        JSXText(nodo) {
          revisar(nodo, nodo.value)
        },
        JSXExpressionContainer(nodo) {
          if (nodo.parent?.type !== 'JSXElement' && nodo.parent?.type !== 'JSXFragment') return
          const expresion = nodo.expression
          if (expresion.type === 'Literal' && typeof expresion.value === 'string')
            revisar(expresion, expresion.value)
          else if (expresion.type === 'TemplateLiteral' && expresion.expressions.length === 0) {
            revisar(expresion, expresion.quasis.map((c) => c.value.cooked ?? c.value.raw).join(''))
          }
        },
      }
    },
  }
}

function reglaExcepcionConMotivo() {
  return {
    meta: { type: 'problem', schema: [] },
    create(context) {
      return {
        Program() {
          const sourceCode = context.sourceCode ?? context.getSourceCode()
          for (const comentario of sourceCode.getAllComments()) {
            const texto = comentario.value.trim()
            const m = /^(eslint-disable(?:-next-line|-line)?)\b([\s\S]*)$/.exec(texto)
            if (!m) continue
            const partes = m[2].split(/\s--\s/)
            const reglas = (partes[0] ?? '')
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean)
            const reglaOficio = reglas.find((r) => r.startsWith('oficio/'))
            if (!reglaOficio) continue
            const motivo = partes[1]?.trim()
            if (!motivo) {
              context.report({
                loc: comentario.loc,
                message: `"${reglaOficio}" deshabilitada sin motivo: agregá " -- <motivo>" al comentario "${m[1]}".`,
              })
            }
          }
        },
      }
    },
  }
}

const pluginOficio = {
  meta: { name: 'eslint-plugin-oficio' },
  rules: {
    'sin-texto-degradado': reglaDeConjunto(evaluarTextoDegradado),
    'sin-borde-lateral-de-color': reglaDeConjunto(evaluarBordeLateralDeColor),
    'sin-emoji-como-icono': reglaSinEmojiComoIcono(),
    'sin-foco-oculto': reglaDeConjunto(evaluarFocoOculto),
    'sin-barra-oculta': reglaDeConjunto(evaluarBarraOculta),
    'excepcion-con-motivo': reglaExcepcionConMotivo(),
  },
}

/**
 * Perfil de reglas de oficio del kit: activa en `error` sobre `archivos` las reglas siempre activas,
 * `oficio/excepcion-con-motivo` y las adoptables que el proyecto pase en `adoptadas` porque su
 * DESIGN.md las prohíbe, y agrega un bloque por cada excepción registrada (skill nuevo-proyecto).
 */
export function reglasDeOficio({
  archivos = ['src/**/*.{ts,tsx}'],
  adoptadas = [],
  excepciones = [],
} = {}) {
  for (const regla of adoptadas) {
    if (!REGLAS_ADOPTABLES.some((r) => `oficio/${r}` === regla)) {
      throw new Error(
        `reglasDeOficio: regla adoptada inválida "${regla}"; sólo se adoptan oficio/${REGLAS_ADOPTABLES.join(', oficio/')} (las demás ya están siempre activas)`,
      )
    }
  }
  const activas = [
    ...REGLAS_SIEMPRE.map((regla) => `oficio/${regla}`),
    ...adoptadas,
    'oficio/excepcion-con-motivo',
  ]
  const bloqueBase = {
    files: archivos,
    plugins: { oficio: pluginOficio },
    rules: Object.fromEntries(activas.map((regla) => [regla, 'error'])),
  }
  const bloquesExcepcion = excepciones.map((excepcion) => {
    const { regla, archivos: archivosExcepcion, motivo } = excepcion
    if (!REGLAS_CLICHE.some((r) => `oficio/${r}` === regla)) {
      throw new Error(
        `reglasDeOficio: excepción con regla inválida "${regla}"; debe ser una de oficio/${REGLAS_CLICHE.join(', oficio/')}`,
      )
    }
    if (!Array.isArray(archivosExcepcion) || archivosExcepcion.length === 0) {
      throw new Error(
        `reglasDeOficio: la excepción de "${regla}" necesita "archivos" como arreglo no vacío`,
      )
    }
    if (typeof motivo !== 'string' || motivo.trim() === '') {
      throw new Error(`reglasDeOficio: la excepción de "${regla}" necesita un "motivo" no vacío`)
    }
    if (!activas.includes(regla)) {
      throw new Error(
        `reglasDeOficio: la excepción de "${regla}" sobra porque la regla no está adoptada; quitá la excepción y su desvío, o sumala a "adoptadas" si el DESIGN.md la prohíbe`,
      )
    }
    return { files: archivosExcepcion, rules: { [regla]: 'off' } }
  })
  return defineConfig([bloqueBase, ...bloquesExcepcion])
}

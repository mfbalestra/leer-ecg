// Mide el piso de oficio de la dirección visual (skill implementar-interfaz) sobre la página renderizada.
//
// Uso: pegar en la consola del navegador (integrado o real), o cargar con Playwright vía
// `page.addScriptTag({ path: '.../medir-oficio.js' })`. Después de renderizar el estado a capturar,
// llamar `medirOficio(document, { acento: '--primario' })` y anotar en el registro de verificación de la interfaz
// las medidas que no pasan y las proporciones de acento y de superficie oscura, junto con `vista`: una vista más angosta que la prevista deja elementos
// sin ancho y los excluye como invisibles. Lo que el script
// no mide (clichés de estructura, prueba del trasplante, juicio de jerarquía) sigue a inspección del
// agente. La medida `ubicacion` pertenece al feedback de orientación de
// la skill implementar-interfaz: en una página con índice de secciones, medirla después de bajar.
// La medida `objetivos` depende del ancho de la vista: capturar a 390 y a un ancho de escritorio.
// La medida `alineacion` compara sólo controles de una misma zona de la página: los que casi comparten fila o borde, y los pegados.
// La medida `desborde-de-caja` sólo ve el contenido renderizado: medirla también con cifras y textos extremos.
// La medida `agrupacion` informa, sin fallar, las pilas cuyas separaciones parejas no forman grupos.

function medirOficio(documento, opciones = {}) {
  if (typeof documento?.defaultView?.getComputedStyle !== 'function') {
    return {
      ok: false,
      mensaje: 'documento inválido: falta defaultView.getComputedStyle',
      medidas: [],
    }
  }

  const medidas = [
    medirContraste(documento),
    medirLargoDeLinea(documento),
    medirEscalonesTipograficos(documento),
    medirCorteDeTexto(documento),
    medirCifrasTabulares(documento),
    medirAcento(documento, opciones),
    medirSuperficieOscura(documento),
    medirSeleccion(documento),
    medirBarrasDeDesplazamiento(documento),
    medirFocoVisible(documento),
    medirUbicacion(documento),
    medirObjetivos(documento),
    medirAlineacion(documento),
    medirDesbordeDeCaja(documento),
    medirAgrupacion(documento),
  ]

  const vista = { ancho: documento.defaultView.innerWidth, alto: documento.defaultView.innerHeight }
  return { ok: true, vista, medidas }
}

// ---- visibilidad y recorrido ----

function esVisible(vista, el) {
  if (!el || el.nodeType !== 1) return false
  const estilo = vista.getComputedStyle(el)
  if (!estilo || estilo.display === 'none' || estilo.visibility === 'hidden') return false
  const opacidad = parseFloat(estilo.opacity)
  if (Number.isFinite(opacidad) && opacidad === 0) return false
  const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null
  if (!rect || rect.width <= 0 || rect.height <= 0) return false
  return true
}

function todosLosElementos(raiz) {
  const resultado = []
  ;(function recorrer(nodo) {
    const hijos = nodo && nodo.children ? Array.from(nodo.children) : []
    for (const hijo of hijos) {
      resultado.push(hijo)
      recorrer(hijo)
    }
  })(raiz)
  return resultado
}

function raizDocumento(documento) {
  return documento.body || documento.documentElement
}

function describirObjetivo(el) {
  if (!el) return 'desconocido'
  const tag = el.tagName ? el.tagName.toLowerCase() : 'desconocido'
  const id = el.id ? `#${el.id}` : ''
  const clase =
    el.className && typeof el.className === 'string'
      ? el.className
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => `.${c}`)
          .join('')
      : ''
  return `${tag}${id}${clase}`
}

function tieneTextoPropio(el) {
  return Array.from(el.childNodes || []).some(
    (n) => n.nodeType === 3 && n.textContent && n.textContent.trim() !== '',
  )
}

function pesoNumerico(valor) {
  if (valor === 'bold') return 700
  if (valor === 'normal') return 400
  const n = parseFloat(valor)
  return Number.isFinite(n) ? n : 400
}

// ---- color ----

function parsearColor(texto) {
  if (typeof texto !== 'string') return null
  const t = texto.trim()
  let m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(t)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 }
  m = /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/i.exec(t)
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]
    return { r: +m[1], g: +m[2], b: +m[3], a }
  }
  m = /^color\(\s*srgb\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/i.exec(t)
  if (m) {
    const a = m[4] === undefined ? 1 : +m[4]
    const recortar = (canal) => Math.min(1, Math.max(0, canal)) * 255
    return { r: recortar(+m[1]), g: recortar(+m[2]), b: recortar(+m[3]), a }
  }
  return null
}

// Chrome conserva `oklch()` y otros espacios de color en el estilo computado; el propio navegador
// los convierte a sRGB con `color-mix()`, que puede devolver canales fuera de gama.
function normalizarColor(documento, texto) {
  const directo = parsearColor(texto)
  if (directo) return directo
  if (
    typeof texto !== 'string' ||
    texto.trim() === '' ||
    typeof documento?.createElement !== 'function'
  )
    return null
  const vista = documento.defaultView
  const temporal = documento.createElement('span')
  temporal.style.color = `color-mix(in srgb, ${texto} 100%, transparent)`
  documento.documentElement.appendChild(temporal)
  const resuelto = parsearColor(vista.getComputedStyle(temporal).color)
  documento.documentElement.removeChild(temporal)
  return resuelto
}

function luminanciaRelativa({ r, g, b }) {
  const canal = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}

function razonDeContraste(a, b) {
  const [alta, baja] = [luminanciaRelativa(a), luminanciaRelativa(b)].sort((x, y) => y - x)
  return (alta + 0.05) / (baja + 0.05)
}

function fondoEfectivo(documento, el) {
  const vista = documento.defaultView
  if (!el) return { color: { r: 255, g: 255, b: 255 }, blancoAsumido: true }
  const estilo = vista.getComputedStyle(el)
  if (estilo.backgroundImage && estilo.backgroundImage !== 'none') return { noMedible: true }
  const color = normalizarColor(documento, estilo.backgroundColor)
  if (!color || color.a === 0) return fondoEfectivo(documento, el.parentElement)
  if (color.a >= 1) return { color }
  const debajo = fondoEfectivo(documento, el.parentElement)
  if (debajo.noMedible) return debajo
  return {
    color: {
      r: color.r * color.a + debajo.color.r * (1 - color.a),
      g: color.g * color.a + debajo.color.g * (1 - color.a),
      b: color.b * color.a + debajo.color.b * (1 - color.a),
    },
    blancoAsumido: debajo.blancoAsumido,
  }
}

// ---- medidas ----

function medirContraste(documento) {
  const vista = documento.defaultView
  const elementos = todosLosElementos(raizDocumento(documento))
  let peor = null
  let blancoAsumido = false
  const noMedibles = []
  for (const el of elementos) {
    if (!esVisible(vista, el) || !tieneTextoPropio(el)) continue
    const estilo = vista.getComputedStyle(el)
    const frente = normalizarColor(documento, estilo.color)
    if (!frente) {
      noMedibles.push(`${describirObjetivo(el)}: color no parseable`)
      continue
    }
    const fondo = fondoEfectivo(documento, el)
    if (fondo.noMedible) {
      noMedibles.push(`${describirObjetivo(el)}: fondo con imagen`)
      continue
    }
    if (fondo.blancoAsumido) blancoAsumido = true
    const razon = razonDeContraste(frente, fondo.color)
    const tamano = parseFloat(estilo.fontSize) || 0
    const peso = pesoNumerico(estilo.fontWeight)
    const grande = tamano >= 24 || (tamano >= 18.66 && peso >= 700)
    const umbral = grande ? 3 : 4.5
    if (peor === null || razon < peor.razon) peor = { razon, umbral, el }
  }
  if (peor === null) {
    const detalle = noMedibles.length ? noMedibles.join('; ') : 'no hay pares medibles'
    return { id: 'contraste', estado: 'n/a', valor: null, detalle }
  }
  const valor = Math.round(peor.razon * 100) / 100
  const estado = peor.razon < peor.umbral ? 'fail' : 'pass'
  const partes = [`peor caso ${describirObjetivo(peor.el)} = ${valor}:1 (umbral ${peor.umbral}:1)`]
  if (blancoAsumido) partes.push('sin fondo opaco en algún camino: se asumió blanco')
  if (noMedibles.length) partes.push(`no medibles: ${noMedibles.join('; ')}`)
  const detalle = partes.join('; ')
  return { id: 'contraste', estado, valor, detalle }
}

function medirAnchoCh(documento, contenedor) {
  const span = documento.createElement('span')
  span.style.display = 'inline-block'
  span.style.width = '1ch'
  span.style.visibility = 'hidden'
  span.style.position = 'absolute'
  contenedor.appendChild(span)
  const ancho = span.getBoundingClientRect().width
  contenedor.removeChild(span)
  return ancho
}

function medirLargoDeLinea(documento) {
  const vista = documento.defaultView
  const disposicionDeTarjeta = ['flex', 'inline-flex', 'grid', 'inline-grid']
  const elementos = todosLosElementos(raizDocumento(documento)).filter(
    (el) => ['P', 'LI', 'DD', 'BLOCKQUOTE'].includes(el.tagName) && esVisible(vista, el),
  )
  let maximo = null
  for (const el of elementos) {
    const estilo = vista.getComputedStyle(el)
    if (el.tagName === 'LI' && disposicionDeTarjeta.includes(estilo.display)) continue
    const altoLinea = parseFloat(estilo.lineHeight) || 0
    const rect = el.getBoundingClientRect()
    if (altoLinea <= 0 || rect.height <= 1.5 * altoLinea) continue
    const padIzq = parseFloat(estilo.paddingLeft) || 0
    const padDer = parseFloat(estilo.paddingRight) || 0
    const anchoContenido = (el.clientWidth ?? rect.width) - padIzq - padDer
    const anchoCh = medirAnchoCh(documento, el)
    if (!anchoCh) continue
    const ch = anchoContenido / anchoCh
    if (maximo === null || ch > maximo.ch) maximo = { ch, el }
  }
  if (maximo === null)
    return {
      id: 'largo-de-linea',
      estado: 'n/a',
      valor: null,
      detalle: 'ningún elemento corta línea',
    }
  const valor = Math.round(maximo.ch)
  return {
    id: 'largo-de-linea',
    estado: valor > 75 ? 'fail' : 'pass',
    valor,
    detalle: describirObjetivo(maximo.el),
  }
}

function medirEscalonesTipograficos(documento) {
  const vista = documento.defaultView
  const elementos = todosLosElementos(raizDocumento(documento))
  const roles = []
  // Un rol cuenta si su texto se ve: lo oculto con la técnica de 1 px es sólo para lectores de pantalla.
  const seLee = (e) => {
    if (!esVisible(vista, e)) return false
    const rect = e.getBoundingClientRect()
    return rect.width > 1 && rect.height > 1
  }
  for (const tag of ['H1', 'H2', 'H3', 'H4', 'H5', 'H6']) {
    const el = elementos.find((e) => e.tagName === tag && seLee(e))
    if (el) roles.push({ tag, el })
  }
  const parrafo = elementos.find((e) => e.tagName === 'P' && seLee(e))
  if (parrafo) roles.push({ tag: 'P (cuerpo)', el: parrafo })
  if (roles.length < 2)
    return {
      id: 'escalones-tipograficos',
      estado: 'n/a',
      valor: null,
      detalle: 'menos de dos roles presentes',
    }

  let fallas = 0
  const detalles = []
  for (let i = 0; i < roles.length - 1; i += 1) {
    const a = vista.getComputedStyle(roles[i].el)
    const b = vista.getComputedStyle(roles[i + 1].el)
    const tamA = parseFloat(a.fontSize) || 0
    const tamB = parseFloat(b.fontSize) || 0
    const razonTamano = tamA > 0 && tamB > 0 ? Math.max(tamA, tamB) / Math.min(tamA, tamB) : 0
    const difPeso = Math.abs(pesoNumerico(a.fontWeight) - pesoNumerico(b.fontWeight))
    if (razonTamano < 1.2 && difPeso < 200) {
      fallas += 1
      detalles.push(`${roles[i].tag}→${roles[i + 1].tag}`)
    }
  }
  const detalle = detalles.length
    ? detalles.join(', ')
    : 'todos los pares adyacentes distinguen tamaño o peso'
  return {
    id: 'escalones-tipograficos',
    estado: fallas > 0 ? 'fail' : 'pass',
    valor: fallas,
    detalle,
  }
}

function medirCorteDeTexto(documento) {
  const vista = documento.defaultView
  if (
    vista.CSS &&
    typeof vista.CSS.supports === 'function' &&
    !vista.CSS.supports('text-wrap', 'balance')
  ) {
    return {
      id: 'corte-de-texto',
      estado: 'n/a',
      valor: null,
      detalle: 'sin soporte de text-wrap en este motor',
    }
  }
  const elementos = todosLosElementos(raizDocumento(documento)).filter((el) => esVisible(vista, el))
  const objetivos = elementos.filter((el) => ['H1', 'H2', 'H3', 'P'].includes(el.tagName))
  if (objetivos.length === 0)
    return {
      id: 'corte-de-texto',
      estado: 'n/a',
      valor: null,
      detalle: 'no hay títulos ni párrafos visibles',
    }

  let fallas = 0
  const detalles = []
  for (const el of objetivos) {
    const estilo = vista.getComputedStyle(el)
    const valorEstilo = `${estilo.textWrapStyle || ''} ${estilo.textWrap || ''}`
    if (!/balance|pretty/.test(valorEstilo)) {
      fallas += 1
      detalles.push(describirObjetivo(el))
    }
  }
  const detalle = detalles.length
    ? detalles.join(', ')
    : 'todos ajustan el corte con balance o pretty'
  return { id: 'corte-de-texto', estado: fallas > 0 ? 'fail' : 'pass', valor: fallas, detalle }
}

function medirCifrasTabulares(documento) {
  const vista = documento.defaultView
  const patronNumerico = /^[\d\s$€%+\-−.,()]+$/
  const celdas = todosLosElementos(raizDocumento(documento))
    .filter((el) => ['TD', 'TH'].includes(el.tagName) && esVisible(vista, el))
    .filter((el) => {
      const texto = (el.textContent || '').trim()
      return /\d/.test(texto) && patronNumerico.test(texto)
    })
  if (celdas.length === 0)
    return {
      id: 'cifras-tabulares',
      estado: 'n/a',
      valor: null,
      detalle: 'no hay celdas numéricas',
    }

  const detalles = []
  for (const el of celdas) {
    const estilo = vista.getComputedStyle(el)
    if (!/tabular-nums/.test(estilo.fontVariantNumeric || '')) detalles.push(describirObjetivo(el))
  }
  const detalle = detalles.length ? detalles.join(', ') : 'todas usan tabular-nums'
  return {
    id: 'cifras-tabulares',
    estado: detalles.length > 0 ? 'fail' : 'pass',
    valor: detalles.length,
    detalle,
  }
}

function resolverAcento(documento, acento) {
  if (typeof acento !== 'string' || acento.trim() === '') return null
  const vista = documento.defaultView
  const texto = acento.trim()
  if (texto.startsWith('--')) {
    return normalizarColor(
      documento,
      vista.getComputedStyle(documento.documentElement).getPropertyValue(texto).trim(),
    )
  }
  return normalizarColor(documento, texto)
}

function medirAcento(documento, opciones) {
  const colorAcento = resolverAcento(documento, opciones.acento)
  if (!colorAcento) {
    return {
      id: 'acento',
      estado: 'n/a',
      valor: null,
      detalle: 'sin acento configurado, o no resoluble a color',
    }
  }
  const vista = documento.defaultView
  const anchoVista = vista.innerWidth
  const altoVista = vista.innerHeight
  const elementos = todosLosElementos(raizDocumento(documento)).filter((el) => esVisible(vista, el))
  const coincidentes = elementos.filter((el) => {
    const color = normalizarColor(documento, vista.getComputedStyle(el).backgroundColor)
    return (
      color &&
      color.a > 0 &&
      Math.abs(color.r - colorAcento.r) <= 2 &&
      Math.abs(color.g - colorAcento.g) <= 2 &&
      Math.abs(color.b - colorAcento.b) <= 2
    )
  })
  const conjunto = new Set(coincidentes)
  const externos = coincidentes.filter((el) => {
    let ancestro = el.parentElement
    while (ancestro) {
      if (conjunto.has(ancestro)) return false
      ancestro = ancestro.parentElement
    }
    return true
  })

  let area = 0
  for (const el of externos) {
    const rect = el.getBoundingClientRect()
    const izq = Math.max(0, rect.left ?? 0)
    const arr = Math.max(0, rect.top ?? 0)
    const der = Math.min(anchoVista, (rect.left ?? 0) + rect.width)
    const aba = Math.min(altoVista, (rect.top ?? 0) + rect.height)
    if (der > izq && aba > arr) area += (der - izq) * (aba - arr)
  }
  const totalVista = anchoVista * altoVista
  const valor = Math.round((totalVista > 0 ? area / totalVista : 0) * 1000) / 1000

  // La proporción se informa junto con la estrategia de color de la composición; nunca bloquea.
  return {
    id: 'acento',
    estado: 'pass',
    valor,
    detalle: `estrategia ${opciones.estrategia ?? 'sin declarar'}, valor informativo`,
  }
}

// Oscura: luminancia relativa bajo 0,1, donde un texto blanco ya pasa 7:1. Sobre una página clara, cada
// cruce entre una región clara y una oscura obliga al ojo a readaptarse; la proporción se informa sin
// bloquear. En una página de fondo oscuro (modo oscuro) no aplica.
function medirSuperficieOscura(documento) {
  const LUMINANCIA_OSCURA = 0.1
  const vista = documento.defaultView
  const pagina = fondoEfectivo(documento, raizDocumento(documento))
  if (!pagina.noMedible && luminanciaRelativa(pagina.color) < LUMINANCIA_OSCURA) {
    return {
      id: 'superficie-oscura',
      estado: 'n/a',
      valor: null,
      detalle: 'la página tiene fondo oscuro: la proporción vale para una página clara',
    }
  }
  const oscuros = todosLosElementos(raizDocumento(documento)).filter((el) => {
    if (!esVisible(vista, el)) return false
    const propio = normalizarColor(documento, vista.getComputedStyle(el).backgroundColor)
    if (!propio || propio.a === 0) return false
    const efectivo = fondoEfectivo(documento, el)
    return !efectivo.noMedible && luminanciaRelativa(efectivo.color) < LUMINANCIA_OSCURA
  })
  const conjunto = new Set(oscuros)
  const externos = oscuros.filter((el) => {
    for (let ancestro = el.parentElement; ancestro; ancestro = ancestro.parentElement) {
      if (conjunto.has(ancestro)) return false
    }
    return true
  })
  let area = 0
  for (const el of externos) {
    const rect = el.getBoundingClientRect()
    const ancho = Math.min(vista.innerWidth, rect.left + rect.width) - Math.max(0, rect.left)
    const alto = Math.min(vista.innerHeight, rect.top + rect.height) - Math.max(0, rect.top)
    if (ancho > 0 && alto > 0) area += ancho * alto
  }
  const total = vista.innerWidth * vista.innerHeight
  return {
    id: 'superficie-oscura',
    estado: 'pass',
    valor: Math.round((total > 0 ? area / total : 0) * 1000) / 1000,
    detalle: 'superficies oscuras sobre página clara, valor informativo',
  }
}

function medirSeleccion(documento) {
  const vista = documento.defaultView
  const estilo = vista.getComputedStyle(raizDocumento(documento), '::selection')
  const bg = estilo && estilo.backgroundColor
  if (!bg || bg === 'transparent') {
    return {
      id: 'seleccion',
      estado: 'fail',
      valor: bg ?? null,
      detalle: 'sin background-color propio en ::selection',
    }
  }
  const color = normalizarColor(documento, bg)
  if (color && color.a === 0) {
    return { id: 'seleccion', estado: 'fail', valor: bg, detalle: 'background-color con alfa 0' }
  }
  return { id: 'seleccion', estado: 'pass', valor: bg, detalle: 'estilo propio en ::selection' }
}

function esDesplazable(vista, el, esRaiz) {
  if (esRaiz) return true
  const estilo = vista.getComputedStyle(el)
  const overflow = estilo.overflowY
  return (
    (overflow === 'auto' || overflow === 'scroll') &&
    (el.scrollHeight ?? 0) > (el.clientHeight ?? 0)
  )
}

function recorrerReglas(documento, callback) {
  let hojasIlegibles = 0
  const recorrerLista = (lista) => {
    for (const regla of Array.from(lista)) {
      callback(regla)
      if (regla.cssRules) recorrerLista(regla.cssRules)
    }
  }
  for (const hoja of Array.from(documento.styleSheets || [])) {
    try {
      const reglas = hoja.cssRules
      if (reglas) recorrerLista(reglas)
    } catch {
      hojasIlegibles += 1
    }
  }
  return { hojasIlegibles }
}

function medirBarrasDeDesplazamiento(documento) {
  const vista = documento.defaultView
  const candidatos = [
    { el: documento.documentElement, esRaiz: true },
    ...todosLosElementos(raizDocumento(documento))
      .filter((el) => esVisible(vista, el))
      .map((el) => ({ el, esRaiz: false })),
  ]
  const desplazables = candidatos.filter(({ el, esRaiz }) => esDesplazable(vista, el, esRaiz))
  const oculto = desplazables.find(({ el }) => vista.getComputedStyle(el).scrollbarWidth === 'none')
  if (oculto) {
    return {
      id: 'barras-de-desplazamiento',
      estado: 'fail',
      valor: 'none',
      detalle: `barra oculta en ${describirObjetivo(oculto.el)}`,
    }
  }
  const colorDoc = vista.getComputedStyle(documento.documentElement).scrollbarColor
  const colorBody = vista.getComputedStyle(raizDocumento(documento)).scrollbarColor
  const color = [colorDoc, colorBody].find((c) => c && c !== 'auto' && c.trim() !== '')
  if (color) {
    return {
      id: 'barras-de-desplazamiento',
      estado: 'pass',
      valor: color,
      detalle: 'scrollbar-color propio',
    }
  }
  let webkit = false
  recorrerReglas(documento, (regla) => {
    if (!webkit && regla.selectorText && regla.selectorText.includes('::-webkit-scrollbar'))
      webkit = true
  })
  if (webkit) {
    return {
      id: 'barras-de-desplazamiento',
      estado: 'pass',
      valor: null,
      detalle: 'regla ::-webkit-scrollbar propia',
    }
  }
  return {
    id: 'barras-de-desplazamiento',
    estado: 'fail',
    valor: null,
    detalle: 'sin scrollbar-color ni regla ::-webkit-scrollbar',
  }
}

function medirFocoVisible(documento) {
  let encontrado = false
  const { hojasIlegibles } = recorrerReglas(documento, (regla) => {
    if (
      encontrado ||
      !regla.selectorText ||
      !regla.selectorText.includes(':focus-visible') ||
      !regla.style
    )
      return
    const outline = regla.style.outline || regla.style.outlineStyle
    const sombra = regla.style.boxShadow
    if ((outline && outline !== 'none') || (sombra && sombra !== 'none')) encontrado = true
  })
  if (encontrado) {
    return {
      id: 'foco-visible',
      estado: 'pass',
      valor: null,
      detalle: 'regla :focus-visible con outline o box-shadow propios',
    }
  }
  if (hojasIlegibles > 0) {
    return {
      id: 'foco-visible',
      estado: 'n/a',
      valor: hojasIlegibles,
      detalle: `${hojasIlegibles} hoja(s) de estilo no legible(s) (otro origen)`,
    }
  }
  return {
    id: 'foco-visible',
    estado: 'fail',
    valor: null,
    detalle: 'sin regla :focus-visible con outline o box-shadow',
  }
}

// ---- indicador de foco (WCAG 1.4.11: 3:1 contra el fondo que lo rodea) ----

// La usa quien recorre la página con Tab: `prepararMedidaDeFoco` sin nada enfocado, después de cada
// Tab `medirIndicadorDeFoco` y al final `terminarMedidaDeFoco`. Apaga las transiciones mientras dura,
// así el indicador se lee asentado, y guarda cómo se veía cada elemento sin foco para reconocer lo
// que aparece al enfocar, también en un contenedor (la tarjeta que marca el foco de su enlace).
function prepararMedidaDeFoco(documento) {
  terminarMedidaDeFoco(documento)
  const vista = documento.defaultView
  const quieto = documento.createElement('style')
  quieto.textContent =
    '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}'
  ;(documento.head || documento.documentElement).appendChild(quieto)
  const activo = documento.activeElement
  const antes = new Map()
  for (const el of todosLosElementos(raizDocumento(documento))) {
    if (activo && (el === activo || (typeof el.contains === 'function' && el.contains(activo))))
      continue
    antes.set(el, imagenDeFoco(vista, el))
  }
  vista.__medidaDeFoco = { quieto, antes }
}

function terminarMedidaDeFoco(documento) {
  const vista = documento.defaultView
  const estado = vista.__medidaDeFoco
  if (estado?.quieto?.parentElement) estado.quieto.parentElement.removeChild(estado.quieto)
  delete vista.__medidaDeFoco
}

function piezasDeFoco(estilo) {
  return {
    contorno: `${estilo.outlineStyle}|${estilo.outlineWidth}|${estilo.outlineColor}|${estilo.outlineOffset}`,
    sombra: estilo.boxShadow || 'none',
    borde: estilo.borderTopColor,
    fondo: estilo.backgroundColor,
    texto: estilo.color,
  }
}

// Cómo se ve un elemento y sus dos pseudoelementos: un enlace que cubre su tarjeta marca el foco en
// su `::after`.
function imagenDeFoco(vista, el) {
  return {
    '': piezasDeFoco(vista.getComputedStyle(el)),
    '::before': piezasDeFoco(vista.getComputedStyle(el, '::before') || {}),
    '::after': piezasDeFoco(vista.getComputedStyle(el, '::after') || {}),
  }
}

// El color de una pieza compuesto sobre el fondo que tiene detrás.
function contrasteSobreFondo(documento, color, fondo) {
  const c = normalizarColor(documento, color)
  if (!c || c.a === 0) return null
  const a = c.a ?? 1
  const compuesto = {
    r: c.r * a + fondo.r * (1 - a),
    g: c.g * a + fondo.g * (1 - a),
    b: c.b * a + fondo.b * (1 - a),
  }
  return razonDeContraste(compuesto, fondo)
}

function capasDeSombra(sombra) {
  return !sombra || sombra === 'none' ? [] : sombra.split(/,(?![^(]*\))/).map((c) => c.trim())
}

// Las piezas que aparecieron al enfocar en un elemento o en uno de sus pseudoelementos: contorno,
// capas nuevas de sombra y borde. Cada una se compara con lo que tiene detrás: el fondo del padre si
// queda por fuera, el del propio elemento si va por dentro (sombra `inset`, contorno hacia adentro).
// Sin imagen previa (ya tenía el foco al preparar) cuenta lo que está puesto, salvo el borde.
function piezasVisiblesDeFoco(documento, el, antes, pseudo = '') {
  const vista = documento.defaultView
  const estilo = pseudo ? vista.getComputedStyle(el, pseudo) : vista.getComputedStyle(el)
  if (!estilo || (pseudo && (estilo.content === 'none' || estilo.content === 'normal'))) {
    return { razones: [] }
  }
  const ahora = piezasDeFoco(estilo)
  const fuera = fondoEfectivo(documento, el.parentElement)
  const dentro = fondoEfectivo(documento, el)
  const razones = []
  let noMedible = false
  const medir = (color, porDentro) => {
    const detras = porDentro ? dentro : fuera
    if (detras.noMedible) {
      noMedible = true
      return
    }
    const r = contrasteSobreFondo(documento, color, detras.color)
    if (r !== null) razones.push(r)
  }
  const cambio = (clave) => !antes || antes[clave] !== ahora[clave]
  const ancho = parseFloat(estilo.outlineWidth)
  if (cambio('contorno') && estilo.outlineStyle && estilo.outlineStyle !== 'none' && ancho >= 1) {
    medir(estilo.outlineColor, (parseFloat(estilo.outlineOffset) || 0) <= -ancho)
  }
  if (cambio('sombra') && sombraVisible(ahora.sombra)) {
    const previas = new Set(capasDeSombra(antes?.sombra))
    for (const capa of capasDeSombra(ahora.sombra)) {
      if (previas.has(capa)) continue
      const color = (capa.match(
        /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}/i,
      ) || [''])[0]
      const medidas = (capa.replace(color, '').match(/-?[\d.]+px/g) || []).map(parseFloat)
      if (!colorVisible(color) || !medidas.some((m) => m !== 0)) continue
      medir(color, /\binset\b/.test(capa))
    }
  }
  if (antes && cambio('borde') && parseFloat(estilo.borderTopWidth) >= 1) {
    medir(estilo.borderTopColor, false)
  }
  // Un resaltado de fondo se mide contra el fondo que tenía antes, los dos compuestos sobre lo de atrás.
  if (antes && !pseudo && cambio('fondo')) {
    if (fuera.noMedible) noMedible = true
    else {
      const sobre = (texto) => {
        const c = normalizarColor(documento, texto)
        if (!c) return null
        const a = c.a ?? 1
        return {
          r: c.r * a + fuera.color.r * (1 - a),
          g: c.g * a + fuera.color.g * (1 - a),
          b: c.b * a + fuera.color.b * (1 - a),
        }
      }
      const [previo, actual] = [sobre(antes.fondo), sobre(ahora.fondo)]
      if (previo && actual) razones.push(razonDeContraste(actual, previo))
    }
  }
  const otroCambio = Boolean(antes) && cambio('texto')
  return { razones, noMedible, otroCambio }
}

// Un contenedor marca el foco de un control si es su única parada de Tab (la tarjeta de un enlace) o
// si el control ocupa al menos la mitad de él (el campo de un grupo con su botón). Una barra con varios
// controles que se resalta entera no dice cuál tiene el foco.
function marcaAlControl(contenedor, control) {
  const paradas = todosLosElementos(contenedor).filter(
    (e) => esObjetivo(e) && atributo(e, 'tabindex') !== '-1' && e.disabled !== true,
  )
  if (paradas.length <= 1) return true
  const a = contenedor.getBoundingClientRect()
  const b = control.getBoundingClientRect()
  return a.width * a.height > 0 && (b.width * b.height) / (a.width * a.height) >= 0.5
}

function medirIndicadorDeFoco(documento) {
  const vista = documento.defaultView
  const el = documento.activeElement
  if (!el || el === documento.body || el === documento.documentElement) {
    return { id: 'indicador-de-foco', estado: 'n/a', valor: null, detalle: 'nada enfocado' }
  }
  const antes = vista.__medidaDeFoco?.antes
  const control = describirControl(el)
  let mejor = null
  let noMedible = false
  let otroCambio = false
  const sumar = (piezas) => {
    if (piezas.noMedible) noMedible = true
    if (piezas.otroCambio) otroCambio = true
    for (const r of piezas.razones) mejor = mejor === null ? r : Math.max(mejor, r)
  }
  const propia = antes?.get(el)
  for (const pseudo of ['', '::before', '::after']) {
    sumar(piezasVisiblesDeFoco(documento, el, propia?.[pseudo], pseudo))
  }
  // Hasta cuatro contenedores: más arriba, un cambio ya no marca a este control.
  for (
    let nodo = el.parentElement, nivel = 1;
    nodo && nodo.nodeType === 1 && nivel <= 4;
    nodo = nodo.parentElement, nivel++
  ) {
    const previo = antes?.get(nodo)
    if (!previo || !marcaAlControl(nodo, el)) continue
    sumar(piezasVisiblesDeFoco(documento, nodo, previo[''], ''))
  }
  const base = { id: 'indicador-de-foco', control }
  if (mejor === null) {
    if (otroCambio) {
      return {
        ...base,
        estado: 'n/a',
        valor: null,
        detalle: `${control}: indicador no reconocido (sólo cambia el color del texto); revisarlo a ojo`,
      }
    }
    if (noMedible)
      return { ...base, estado: 'n/a', valor: null, detalle: `${control}: fondo con imagen` }
    return {
      ...base,
      estado: 'fail',
      valor: 0,
      detalle: `${control}: sin indicador de foco visible`,
    }
  }
  const valor = Math.round(mejor * 100) / 100
  return mejor >= 3
    ? { ...base, estado: 'pass', valor, detalle: `${control}: ${valor}:1` }
    : {
        ...base,
        estado: 'fail',
        valor,
        detalle: `${control}: indicador de foco ${valor}:1 (umbral 3:1)`,
      }
}

// ---- ubicación (feedback de orientación) ----

function atributo(el, nombre) {
  return typeof el.getAttribute === 'function' ? el.getAttribute(nombre) : null
}

function esNavegacion(el) {
  return el.tagName === 'NAV' || atributo(el, 'role') === 'navigation'
}

function destinoDelEnlace(enlace, actual) {
  const crudo = atributo(enlace, 'href')
  if (crudo === null || crudo === '' || crudo === '#' || /^javascript:/i.test(crudo)) return null
  const absoluto = typeof enlace.href === 'string' && enlace.href !== '' ? enlace.href : crudo
  const corte = absoluto.indexOf('#')
  const base = corte === -1 ? absoluto : absoluto.slice(0, corte)
  const ancla = corte === -1 ? '' : absoluto.slice(corte + 1)
  if (base !== actual) return null
  return ancla === '' ? { tipo: 'pagina' } : { tipo: 'seccion', id: decodeURIComponent(ancla) }
}

function evaluarNavegacion(documento, nav, actual) {
  const enlaces = todosLosElementos(nav).filter((el) => el.tagName === 'A')
  if (enlaces.length < 2) return null
  const destinos = enlaces.map((a) => destinoDelEnlace(a, actual)).filter(Boolean)
  if (destinos.length === 0) return null
  const marcado = todosLosElementos(nav).some((el) => {
    const valor = atributo(el, 'aria-current')
    return valor !== null && valor !== 'false'
  })
  if (marcado) return 'pass'
  if (destinos.some((d) => d.tipo === 'pagina')) return 'fail'
  const buscar = (id) =>
    typeof documento.getElementById === 'function' ? documento.getElementById(id) : null
  const comienzos = destinos
    .map((d) => buscar(d.id))
    .filter((el) => el && typeof el.getBoundingClientRect === 'function')
    .map((el) => el.getBoundingClientRect().top)
  if (comienzos.length === 0) return null
  // Fracción de la vista, desde arriba, que el comienzo de la primera sección enlazada tiene que haber
  // cruzado para que la persona ya esté dentro de ella; antes de esa línea, sin marca es correcto.
  const LINEA_DE_SECCION = 0.3
  const linea = documento.defaultView.innerHeight * LINEA_DE_SECCION
  return Math.min(...comienzos) <= linea ? 'fail' : 'antes'
}

function medirUbicacion(documento) {
  const vista = documento.defaultView
  const ubicacion = documento.location || vista.location
  if (!ubicacion || typeof ubicacion.href !== 'string') {
    return { id: 'ubicacion', estado: 'n/a', valor: null, detalle: 'sin ubicación del documento' }
  }
  const actual = ubicacion.href.split('#')[0]
  const navegaciones = todosLosElementos(raizDocumento(documento)).filter(
    (el) => esNavegacion(el) && esVisible(vista, el),
  )
  const resultados = navegaciones.map((nav) => ({
    nav,
    estado: evaluarNavegacion(documento, nav, actual),
  }))
  const fallida = resultados.find((r) => r.estado === 'fail')
  if (fallida) {
    return {
      id: 'ubicacion',
      estado: 'fail',
      valor: null,
      detalle: `${describirObjetivo(fallida.nav)} enlaza a esta página o a sus secciones sin aria-current`,
    }
  }
  const marcadas = resultados.filter((r) => r.estado === 'pass').length
  if (marcadas > 0) {
    return {
      id: 'ubicacion',
      estado: 'pass',
      valor: marcadas,
      detalle: `${marcadas} navegación(es) marcan la ubicación actual`,
    }
  }
  if (resultados.some((r) => r.estado === 'antes')) {
    return {
      id: 'ubicacion',
      estado: 'n/a',
      valor: null,
      detalle: 'antes de la primera sección enlazada: medir después de bajar',
    }
  }
  return {
    id: 'ubicacion',
    estado: 'n/a',
    valor: null,
    detalle: 'sin navegación que enlace a esta página o a sus secciones',
  }
}

// ---- objetivos táctiles (piso de accesibilidad) ----

// Roles de control de WAI-ARIA que se activan con el puntero. `gridcell` y `row` no entran: una celda
// o una fila no son operables por su rol. El `<option>` nativo lo dibuja el navegador (excepción de
// WCAG 2.5.8) y no trae rol explícito, así que no se cuenta.
function esObjetivo(el) {
  if (el.tagName === 'A') return atributo(el, 'href') !== null
  if (el.tagName === 'INPUT') return atributo(el, 'type') !== 'hidden'
  if (['BUTTON', 'SELECT', 'SUMMARY'].includes(el.tagName)) return true
  return [
    'button',
    'link',
    'checkbox',
    'switch',
    'radio',
    'tab',
    'option',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'treeitem',
    'combobox',
    'slider',
    'spinbutton',
    'textbox',
    'searchbox',
  ].includes(atributo(el, 'role'))
}

// Oculto a la vista con la técnica de 1px o fuera del árbol de accesibilidad: no es algo que se toque.
function ocultoALaVista(el) {
  if (atributo(el, 'aria-hidden') === 'true') return true
  const caja = el.getBoundingClientRect()
  return caja.width <= 1 || caja.height <= 1
}

function esOperable(vista, el) {
  if (ocultoALaVista(el)) return false
  if (el.disabled === true || atributo(el, 'aria-disabled') === 'true') return false
  return vista.getComputedStyle(el).pointerEvents !== 'none'
}

function enTextoCorrido(el) {
  return el.tagName === 'A' && el.parentElement ? tieneTextoPropio(el.parentElement) : false
}

// Un `::before` o `::after` en absoluto también recibe el toque: amplía el área de un ícono chico o
// cubre la tarjeta de su enlace (técnicas CSS de la skill implementar-interfaz). Se ubica contra el ancestro
// posicionado más cercano, o el propio control; si el control recorta lo que desborda, no amplía nada.
// Sólo cuenta el pseudoelemento que toca la caja del control (un adorno lejano no amplía nada) y
// sólo la parte que dejan ver el bloque contenedor y los ancestros de más arriba que recortan.
function cajaConPseudo(vista, el, propia) {
  let bloque = el
  while (bloque && !generaBloqueContenedor(vista.getComputedStyle(bloque))) {
    bloque = bloque.parentElement
  }
  if (!bloque) return propia
  const base = bloque.getBoundingClientRect()
  const estiloBloque = vista.getComputedStyle(bloque)
  // El desplazamiento de la página ya está en la caja de `html` y `body`; el de un contenedor, no.
  const raiz = bloque.tagName === 'HTML' || bloque.tagName === 'BODY'
  const origenX =
    base.left +
    (parseFloat(estiloBloque.borderLeftWidth) || 0) -
    (raiz ? 0 : bloque.scrollLeft || 0)
  const origenY =
    base.top + (parseFloat(estiloBloque.borderTopWidth) || 0) - (raiz ? 0 : bloque.scrollTop || 0)
  let caja = propia
  for (const pseudo of ['::before', '::after']) {
    const p = vista.getComputedStyle(el, pseudo)
    if (!p || p.content === 'none' || p.content === 'normal' || p.position !== 'absolute') continue
    if (p.display === 'none' || p.visibility === 'hidden' || p.pointerEvents === 'none') continue
    const [x, y, ancho, alto] = [p.left, p.top, p.width, p.height].map((v) => parseFloat(v))
    if (![x, y, ancho, alto].every(Number.isFinite)) continue
    const area = { left: origenX + x, top: origenY + y, width: ancho, height: alto }
    if (!interseccionDeCajas(area, propia)) continue
    caja = unionDeCajas(caja, area)
  }
  if (caja === propia) return propia
  for (let a = bloque; a && a.tagName !== 'HTML' && a.tagName !== 'BODY'; a = a.parentElement) {
    const e = a === bloque ? estiloBloque : vista.getComputedStyle(a)
    if (![e.overflow, e.overflowX, e.overflowY].some((v) => v && v !== 'visible')) continue
    caja = interseccionDeCajas(caja, a.getBoundingClientRect()) || propia
  }
  return unionDeCajas(caja, propia)
}

// Un ancestro posicionado, transformado, filtrado o con contención de diseño ubica a sus hijos en absoluto.
function generaBloqueContenedor(estilo) {
  if ((estilo.position || 'static') !== 'static') return true
  const efectos = [
    'transform',
    'translate',
    'scale',
    'rotate',
    'filter',
    'backdropFilter',
    'perspective',
  ]
  if (efectos.some((p) => estilo[p] && estilo[p] !== 'none')) return true
  return (
    /layout|paint|strict|content/.test(estilo.contain || '') ||
    /transform|filter|perspective/.test(estilo.willChange || '')
  )
}

function interseccionDeCajas(a, b) {
  const izquierda = Math.max(a.left, b.left)
  const arriba = Math.max(a.top, b.top)
  const derecha = Math.min(a.left + a.width, b.left + b.width)
  const abajo = Math.min(a.top + a.height, b.top + b.height)
  if (derecha < izquierda || abajo < arriba) return null
  return { left: izquierda, top: arriba, width: derecha - izquierda, height: abajo - arriba }
}

function unionDeCajas(a, b) {
  const izquierda = Math.min(a.left, b.left)
  const arriba = Math.min(a.top, b.top)
  const derecha = Math.max(a.left + a.width, b.left + b.width)
  const abajo = Math.max(a.top + a.height, b.top + b.height)
  return { left: izquierda, top: arriba, width: derecha - izquierda, height: abajo - arriba }
}

// Dos áreas ampliadas que se pisan se reparten el toque: ninguna conserva la ampliación. Un área que
// contiene a otro control entero (la tarjeta que cubre su enlace, con un botón encima) no compite con él.
function quitarAmpliacionesQueSePisan(objetivos, cajas, propias) {
  const pisadas = objetivos.filter((el) => {
    const caja = cajas.get(el)
    if (caja === propias.get(el)) return false
    return objetivos.some((otro) => {
      if (otro === el) return false
      const ajena = cajas.get(otro)
      const comun = interseccionDeCajas(caja, ajena)
      // Hasta 2 px de cruce es un borde compartido (filas con margen negativo), no un área en disputa.
      if (!comun || comun.width <= 2 || comun.height <= 2) return false
      return !contiene(caja, ajena, 0.5) && !contiene(ajena, caja, 0.5)
    })
  })
  for (const el of pisadas) cajas.set(el, propias.get(el))
}

function cajaDelObjetivo(documento, el, conPseudo = true) {
  const rect = el.getBoundingClientRect()
  const propia = conPseudo ? cajaConPseudo(documento.defaultView, el, rect) : rect
  const tipo = atributo(el, 'type')
  if (el.tagName !== 'INPUT' || (tipo !== 'checkbox' && tipo !== 'radio')) return propia
  const envolvente = typeof el.closest === 'function' ? el.closest('label') : null
  const porId =
    el.id && typeof documento.querySelector === 'function'
      ? documento.querySelector(`label[for="${el.id}"]`)
      : null
  const etiqueta = envolvente || porId
  if (!etiqueta) return propia
  const caja = etiqueta.getBoundingClientRect()
  return caja.width * caja.height > propia.width * propia.height ? caja : propia
}

function centro(caja) {
  return { x: caja.left + caja.width / 2, y: caja.top + caja.height / 2 }
}

function distanciaACaja(punto, caja) {
  const dx = Math.max(caja.left - punto.x, 0, punto.x - (caja.left + caja.width))
  const dy = Math.max(caja.top - punto.y, 0, punto.y - (caja.top + caja.height))
  return Math.hypot(dx, dy)
}

function espaciadoSuficiente(el, objetivos, bajoUmbral, cajas) {
  const propio = centro(cajas.get(el))
  return objetivos.every((otro) => {
    if (otro === el) return true
    const caja = cajas.get(otro)
    if (bajoUmbral.includes(otro)) {
      const ajeno = centro(caja)
      return Math.hypot(propio.x - ajeno.x, propio.y - ajeno.y) >= 24
    }
    return distanciaACaja(propio, caja) >= 12
  })
}

function medirObjetivos(documento) {
  const vista = documento.defaultView
  // 44 px donde se toca con el dedo, por debajo de 768 px de
  // ancho, y 24 px (WCAG 2.2 AA) en el resto.
  const umbral = vista.innerWidth < 768 ? 44 : 24
  const objetivos = todosLosElementos(raizDocumento(documento)).filter(
    (el) => esObjetivo(el) && esVisible(vista, el) && esOperable(vista, el) && !enTextoCorrido(el),
  )
  if (objetivos.length === 0) {
    return { id: 'objetivos', estado: 'n/a', valor: umbral, detalle: 'sin controles visibles' }
  }
  const cajas = new Map(objetivos.map((el) => [el, cajaDelObjetivo(documento, el)]))
  const propias = new Map(objetivos.map((el) => [el, cajaDelObjetivo(documento, el, false)]))
  for (const el of objetivos) {
    const [caja, propia] = [cajas.get(el), propias.get(el)]
    if (['left', 'top', 'width', 'height'].every((k) => caja[k] === propia[k]))
      cajas.set(el, propia)
  }
  quitarAmpliacionesQueSePisan(objetivos, cajas, propias)
  const bajoUmbral = objetivos.filter((el) => {
    const caja = cajas.get(el)
    return caja.width < umbral || caja.height < umbral
  })
  // Sólo con el umbral de 24 vale la excepción de espaciado de
  // WCAG 2.2: el círculo de 24 px centrado en el control no toca a otro control ni a otro círculo así.
  const chicos =
    umbral === 24
      ? bajoUmbral.filter((el) => !espaciadoSuficiente(el, objetivos, bajoUmbral, cajas))
      : bajoUmbral
  if (chicos.length > 0) {
    const caja = cajas.get(chicos[0])
    return {
      id: 'objetivos',
      estado: 'fail',
      valor: umbral,
      detalle: `${chicos.length} control(es) bajo ${umbral}px; ${describirObjetivo(chicos[0])} mide ${Math.round(caja.width)}×${Math.round(caja.height)}`,
    }
  }
  return {
    id: 'objetivos',
    estado: 'pass',
    valor: umbral,
    detalle:
      umbral === 24
        ? `${objetivos.length} control(es) de al menos 24px o con espaciado suficiente`
        : `${objetivos.length} control(es) de al menos ${umbral}px`,
  }
}

// ---- alineación ----

// No todo tiene que alinearse: una diferencia grande es una decisión de la composición. Lo que falla
// es lo que casi coincide, un intento de alinear que quedó corrido unos píxeles, y dos controles de
// una misma fila pegados sin espacio entre ellos. En una fila compara arriba, centro y abajo; en una
// columna, el borde de lectura y el centro: un borde derecho cercano suele ser casualidad. Límites:
// fila 8 px, columna 4 px, medio píxel de tolerancia. Sin constantes de módulo: la guardia carga el script dos veces en el mismo contexto.
function limitesDeAlineacion() {
  return {
    fila: 8,
    columna: 4,
    tolerancia: 0.5,
    gruposPegados: ['group', 'radiogroup', 'toolbar', 'tablist'],
  }
}

function contiene(a, b, tolerancia) {
  return (
    a.left <= b.left + tolerancia &&
    a.top <= b.top + tolerancia &&
    a.left + a.width >= b.left + b.width - tolerancia &&
    a.top + a.height >= b.top + b.height - tolerancia
  )
}

function solapamiento(inicioA, largoA, inicioB, largoB) {
  return Math.min(inicioA + largoA, inicioB + largoB) - Math.max(inicioA, inicioB)
}

function menorDiferencia(pares) {
  return Math.min(...pares.map(([a, b]) => Math.abs(a - b)))
}

// Botones de un grupo segmentado o pestañas se tocan a propósito: el contenedor común lo declara.
function enGrupoPegado(a, b, grupos) {
  const ancestros = new Set()
  for (let el = a.parentElement; el; el = el.parentElement) ancestros.add(el)
  for (let el = b.parentElement; el; el = el.parentElement) {
    if (ancestros.has(el)) return grupos.includes(atributo(el, 'role'))
  }
  return false
}

// La zona de primer nivel es la región más externa que contiene al control: un menú lateral y el
// contenido principal no se alinean entre sí, pero los controles de un mismo encabezado sí.
function zonaDePagina(el) {
  const etiquetas = ['MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV']
  const roles = ['main', 'complementary', 'banner', 'contentinfo', 'navigation']
  let zona = null
  for (let actual = el.parentElement; actual; actual = actual.parentElement) {
    if (etiquetas.includes(actual.tagName) || roles.includes(atributo(actual, 'role'))) {
      zona = actual
    }
  }
  return zona
}

// Un color se ve salvo que sea transparente o tenga alfa 0, en cualquier notación (rgb, hex, oklch…).
function colorVisible(color) {
  if (typeof color !== 'string' || color.trim() === '' || color.trim() === 'transparent')
    return false
  const c = parsearColor(color)
  if (c !== null) return c.a > 0
  return !/\/\s*0(\.0+)?%?\s*\)$/.test(color.trim())
}

// Una sombra se ve si alguna de sus capas tiene color visible y alguna medida distinta de cero.
function sombraVisible(sombra) {
  if (typeof sombra !== 'string' || sombra === '' || sombra === 'none') return false
  const capas = sombra.split(/,(?![^(]*\))/)
  return capas.some((capa) => {
    const color = (capa.match(
      /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}/i,
    ) || [''])[0]
    const medidas = capa.replace(color, '').match(/-?[\d.]+px/g) || []
    return colorVisible(color) && medidas.some((m) => parseFloat(m) !== 0)
  })
}

function pintaCaja(vista, el) {
  const estilo = vista.getComputedStyle(el)
  if (!estilo) return false
  const opaco = colorVisible
  const borde = ['Top', 'Right', 'Bottom', 'Left'].some(
    (lado) =>
      parseFloat(estilo[`border${lado}Width`]) > 0 &&
      estilo[`border${lado}Style`] !== 'none' &&
      opaco(estilo[`border${lado}Color`]),
  )
  const sombra = sombraVisible(estilo.boxShadow)
  const fondo = estilo.backgroundImage && estilo.backgroundImage !== 'none'
  return borde || sombra || Boolean(fondo) || opaco(estilo.backgroundColor)
}

// Lo que se ve de un control: su propia caja si la pinta; si no, la del contenedor ajustado que la
// pinta por él (el campo de un buscador con borde, la flecha que vive dentro de ese borde). Sin
// ninguna de las dos, el control no dibuja borde: un enlace con relleno puede tocar a otro sin verse pegado.
function cajaVisible(vista, el) {
  const propia = el.getBoundingClientRect()
  if (pintaCaja(vista, el)) return { caja: propia, pinta: true }
  for (
    let padre = el.parentElement;
    padre && padre.tagName !== 'BODY';
    padre = padre.parentElement
  ) {
    const caja = padre.getBoundingClientRect()
    if (caja.height > propia.height + 16 || caja.width > propia.width + 64) break
    if (pintaCaja(vista, padre)) return { caja, pinta: true }
  }
  return { caja: propia, pinta: false }
}

function describirControl(el) {
  const tag = el.tagName ? el.tagName.toLowerCase() : 'control'
  if (el.id) return `${tag}#${el.id}`
  const nombre = atributo(el, 'aria-label') || (el.textContent || '').trim().slice(0, 30)
  return nombre ? `${tag} «${nombre}»` : tag
}

// Lo que queda detrás de un diálogo modal está inerte: no se compara con lo que está encima.
function inerte(el) {
  return typeof el.closest === 'function' && el.closest('[inert], [aria-hidden="true"]') !== null
}

function medirAlineacion(documento) {
  const vista = documento.defaultView
  const controles = todosLosElementos(raizDocumento(documento)).filter(
    (el) =>
      (esObjetivo(el) || el.tagName === 'TEXTAREA') &&
      esVisible(vista, el) &&
      !ocultoALaVista(el) &&
      !inerte(el) &&
      !enTextoCorrido(el),
  )
  if (controles.length < 2) {
    return { id: 'alineacion', estado: 'n/a', valor: 0, detalle: 'menos de dos controles visibles' }
  }
  const limites = limitesDeAlineacion()
  const casiCoincide = (diferencia, limite) =>
    diferencia > limites.tolerancia && diferencia <= limite
  const visibles = controles.map((el) => cajaVisible(vista, el))
  const zonas = controles.map(zonaDePagina)
  const fallas = []
  for (let i = 0; i < controles.length; i++) {
    for (let j = i + 1; j < controles.length; j++) {
      if (zonas[i] && zonas[j] && zonas[i] !== zonas[j]) continue
      const a = visibles[i].caja
      const b = visibles[j].caja
      if (contiene(a, b, limites.tolerancia) || contiene(b, a, limites.tolerancia)) continue
      // Sólo vecinos: dos controles lejanos no intentan alinearse entre sí.
      const cercania = 2 * Math.max(a.height, b.height)
      const espacioX = Math.max(b.left - (a.left + a.width), a.left - (b.left + b.width))
      const espacioY = Math.max(b.top - (a.top + a.height), a.top - (b.top + b.height))
      const enFila =
        solapamiento(a.top, a.height, b.top, b.height) >= Math.min(a.height, b.height) / 2
      const enColumna = solapamiento(a.left, a.width, b.left, b.width) > 0
      const par = `${describirControl(controles[i])} y ${describirControl(controles[j])}`
      if (enFila && !enColumna && espacioX <= cercania) {
        const diferencia = menorDiferencia([
          [a.top, b.top],
          [a.top + a.height / 2, b.top + b.height / 2],
          [a.top + a.height, b.top + b.height],
        ])
        if (casiCoincide(diferencia, limites.fila)) {
          fallas.push(`${par} casi comparten la fila: corridos ${Math.round(diferencia)}px`)
        }
        if (
          espacioX < limites.tolerancia &&
          visibles[i].pinta &&
          visibles[j].pinta &&
          !enGrupoPegado(controles[i], controles[j], limites.gruposPegados)
        ) {
          fallas.push(`${par} están pegados en la fila`)
        }
      } else if (enColumna && !enFila && espacioY <= cercania) {
        const diferencia = menorDiferencia([
          [a.left, b.left],
          [a.left + a.width / 2, b.left + b.width / 2],
        ])
        if (casiCoincide(diferencia, limites.columna)) {
          fallas.push(`${par} casi comparten el borde: corridos ${Math.round(diferencia)}px`)
        }
      }
    }
  }
  if (fallas.length > 0) {
    return {
      id: 'alineacion',
      estado: 'fail',
      valor: fallas.length,
      detalle: fallas.slice(0, 5).join('; '),
    }
  }
  return {
    id: 'alineacion',
    estado: 'pass',
    valor: 0,
    detalle: `${controles.length} controles sin casi-alineaciones`,
  }
}

// ---- desborde de caja ----

function desplazaEnX(estilo) {
  return estilo.overflowX === 'auto' || estilo.overflowX === 'scroll'
}

function cajaContenedora(vista, el, documento) {
  let actual = el.parentElement
  while (actual && actual !== documento.body && actual !== documento.documentElement) {
    const display = vista.getComputedStyle(actual).display
    if (display !== 'inline' && display !== 'contents') return actual
    actual = actual.parentElement
  }
  return null
}

// El texto de un dibujo SVG no tiene caja propia: sus anchos de desplazamiento no dicen nada, y el
// borde que lo recorta es el del <svg> más cercano, no el de la caja HTML que rodea al dibujo.
function dibujoQueLoContiene(el) {
  return el.namespaceURI === 'http://www.w3.org/2000/svg' && el.ownerSVGElement
    ? el.ownerSVGElement
    : null
}

// Texto que se sale de su propia caja o de la caja que lo contiene, se vea recortado o encimado.
// Un truncado con puntos suspensivos y un contenedor con desplazamiento horizontal son decisiones; el
// desborde de toda la página lo informa quien mide la vista.
function medirDesbordeDeCaja(documento) {
  const vista = documento.defaultView
  const textos = todosLosElementos(raizDocumento(documento)).filter(
    (el) => esVisible(vista, el) && tieneTextoPropio(el) && !ocultoALaVista(el),
  )
  const fallas = []
  for (const el of textos) {
    const estilo = vista.getComputedStyle(el)
    if (estilo.position === 'absolute' || estilo.position === 'fixed') continue
    const trunca = estilo.textOverflow === 'ellipsis'
    const dibujo = dibujoQueLoContiene(el)
    if (
      !dibujo &&
      estilo.display !== 'inline' &&
      !trunca &&
      !desplazaEnX(estilo) &&
      typeof el.scrollWidth === 'number' &&
      el.scrollWidth > el.clientWidth + 1
    ) {
      fallas.push(
        `${describirObjetivo(el)}: el texto pasa ${Math.round(el.scrollWidth - el.clientWidth)}px su caja`,
      )
      continue
    }
    const contenedor = dibujo || cajaContenedora(vista, el, documento)
    if (!contenedor || desplazaEnX(vista.getComputedStyle(contenedor))) continue
    const caja = el.getBoundingClientRect()
    const borde = contenedor.getBoundingClientRect()
    const exceso = Math.max(
      borde.left - caja.left,
      caja.left + caja.width - (borde.left + borde.width),
    )
    if (exceso > 1) {
      fallas.push(
        `${describirObjetivo(el)}: pasa ${Math.round(exceso)}px a ${describirObjetivo(contenedor)}`,
      )
    }
  }
  if (fallas.length > 0) {
    return {
      id: 'desborde-de-caja',
      estado: 'fail',
      valor: fallas.length,
      detalle: fallas.slice(0, 5).join('; '),
    }
  }
  return {
    id: 'desborde-de-caja',
    estado: textos.length === 0 ? 'n/a' : 'pass',
    valor: 0,
    detalle:
      textos.length === 0 ? 'no hay texto visible' : `${textos.length} textos dentro de su caja`,
  }
}

// ---- agrupación ----

function rolDePieza(el) {
  const tag = (el.tagName || '').toUpperCase()
  if (
    ['IMG', 'SVG', 'PICTURE', 'CANVAS', 'VIDEO'].includes(tag) ||
    atributo(el, 'role') === 'img'
  ) {
    return 'imagen'
  }
  if (/^H[1-6]$/.test(tag)) return 'titulo'
  if (['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return 'accion'
  if (tieneTextoPropio(el)) return 'texto'
  return null
}

// Una pila de cuatro o más piezas de al menos tres roles cuyas separaciones son casi iguales (la
// mayor no llega al doble de la menor) se lee como un solo bloque: el espacio no forma grupos. Se
// informa y nunca falla, porque una separación pareja puede ser deliberada.
function medirAgrupacion(documento) {
  const vista = documento.defaultView
  const contenedores = [raizDocumento(documento), ...todosLosElementos(raizDocumento(documento))]
  let pilas = 0
  const parejasPorDescripcion = new Map()
  for (const contenedor of contenedores) {
    if (!esVisible(vista, contenedor) && contenedor !== raizDocumento(documento)) continue
    const piezas = Array.from(contenedor.children || [])
      .filter((el) => esVisible(vista, el))
      .map((el) => ({ el, caja: el.getBoundingClientRect() }))
    if (piezas.length < 4) continue
    const apiladas = piezas.every(
      (p, i) => i === 0 || p.caja.top >= piezas[i - 1].caja.top + piezas[i - 1].caja.height - 1,
    )
    if (!apiladas) continue
    const roles = new Set(piezas.map((p) => rolDePieza(p.el)).filter(Boolean))
    if (roles.size < 3) continue
    pilas++
    const separaciones = piezas
      .slice(1)
      .map((p, i) =>
        Math.max(0, Math.round(p.caja.top - (piezas[i].caja.top + piezas[i].caja.height))),
      )
    const menor = Math.max(4, Math.min(...separaciones))
    const mayor = Math.max(...separaciones)
    if (mayor < 2 * menor) {
      const clave = describirObjetivo(contenedor)
      const previa = parejasPorDescripcion.get(clave)
      parejasPorDescripcion.set(clave, {
        veces: (previa?.veces ?? 0) + 1,
        separaciones: previa?.separaciones ?? separaciones,
      })
    }
  }
  if (pilas === 0) {
    return {
      id: 'agrupacion',
      estado: 'n/a',
      valor: null,
      detalle: 'no hay pilas de cuatro o más piezas de tres roles',
    }
  }
  return {
    id: 'agrupacion',
    estado: 'pass',
    valor: [...parejasPorDescripcion.values()].reduce((total, p) => total + p.veces, 0),
    detalle:
      parejasPorDescripcion.size > 0
        ? `separaciones parejas, sin grupos: ${[...parejasPorDescripcion]
            .slice(0, 5)
            .map(
              ([clave, p]) =>
                `${clave}${p.veces > 1 ? ` (×${p.veces})` : ''}: ${p.separaciones.join(', ')}px`,
            )
            .join('; ')}`
        : `${pilas} pila(s) agrupadas por el espacio`,
  }
}

globalThis.medirOficio = medirOficio
globalThis.prepararMedidaDeFoco = prepararMedidaDeFoco
globalThis.medirIndicadorDeFoco = medirIndicadorDeFoco
globalThis.terminarMedidaDeFoco = terminarMedidaDeFoco

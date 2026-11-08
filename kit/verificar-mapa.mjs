import { readFileSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const AYUDA = `Uso: node kit/verificar-mapa.mjs --mapa <skill> [--openapi <json>]... [--rutas <archivo>]

Compara el mapa de funcionalidades de la skill de verificación del proyecto con lo que el código
expone y falla si se desfasaron.

  --mapa     el archivo de la skill de verificación, en .agents/skills/verificar-<proyecto>/
  --openapi  un contrato OpenAPI generado (repetible); cada operación necesita su fila «MÉTODO /ruta»
  --rutas    las rutas de pantalla: un .json con una lista, o un módulo que exporta \`rutas\`
             (textos u objetos con \`path\` y \`children\`); cada ruta, con las anidadas unidas a
             la de su padre, necesita su fila «/ruta»; una ruta índice, sin \`path\`, es la del padre

Cada fila nombra en «Journey» el archivo de test que la recorre, relativo a la raíz del proyecto.
Salida: 0 al día, 1 con desfase (una línea por problema), 2 por un uso o una lectura inválidos.`

const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']

function leerArgumentos(argv) {
  const opciones = { mapa: null, openapi: [], rutas: null, ayuda: false }
  const valor = (indice) => {
    const texto = argv[indice + 1]
    if (texto === undefined || texto.startsWith('--'))
      throw new Error(`falta el valor de ${argv[indice]}`)
    return texto
  }
  for (let indice = 0; indice < argv.length; indice++) {
    const clave = argv[indice]
    if (clave === '--help' || clave === '-h') opciones.ayuda = true
    else if (clave === '--mapa') opciones.mapa = valor(indice++)
    else if (clave === '--openapi') opciones.openapi.push(valor(indice++))
    else if (clave === '--rutas') opciones.rutas = valor(indice++)
    else throw new Error(`argumento desconocido: ${clave}`)
  }
  if (!opciones.ayuda && !opciones.mapa) throw new Error('falta --mapa')
  return opciones
}

function normalizarRuta(ruta) {
  return ruta.length > 1 ? ruta.replace(/\/+$/, '') || '/' : ruta
}

function celdas(linea) {
  return linea
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((celda) => celda.replaceAll('`', '').trim())
}

// Devuelve las filas de la tabla bajo «## Feature map» con su entrada y su recorrido.
export function filasDelMapa(texto) {
  const lineas = texto.split(/\r?\n/)
  const inicio = lineas.findIndex((linea) => /^##\s+Feature map\s*$/.test(linea))
  if (inicio === -1) throw new Error('el mapa no tiene la sección «## Feature map»')
  const fin = lineas.findIndex((linea, indice) => indice > inicio && /^##\s/.test(linea))
  const tabla = lineas
    .slice(inicio + 1, fin === -1 ? undefined : fin)
    .filter((linea) => linea.trim().startsWith('|'))
  if (tabla.length < 2) throw new Error('la sección «## Feature map» no tiene tabla')
  const cabecera = celdas(tabla[0]).map((celda) => celda.toLowerCase())
  const columnaEntrada = cabecera.indexOf('entry')
  const columnaRecorrido = cabecera.indexOf('journey')
  if (columnaEntrada === -1 || columnaRecorrido === -1) {
    throw new Error('la tabla del mapa necesita las columnas «Entry» y «Journey»')
  }
  return tabla.slice(2).map((linea) => {
    const fila = celdas(linea)
    return {
      entrada: fila[columnaEntrada] ?? '',
      recorrido: fila[columnaRecorrido] ?? '',
    }
  })
}

// Una entrada «MÉTODO /ruta» es una operación HTTP; «/ruta», una pantalla; otra cosa, un comando.
export function clasificar(entrada) {
  const http = /^([A-Za-z]+)\s+(\/\S*)$/.exec(entrada)
  if (http && METODOS.includes(http[1].toLowerCase())) {
    return {
      tipo: 'http',
      clave: `${http[1].toUpperCase()} ${normalizarRuta(http[2])}`,
    }
  }
  if (/^\/\S*$/.test(entrada)) return { tipo: 'pantalla', clave: normalizarRuta(entrada) }
  return { tipo: 'otro', clave: entrada }
}

const esObjeto = (valor) => typeof valor === 'object' && valor !== null && !Array.isArray(valor)

export function operacionesOpenApi(contrato) {
  if (!esObjeto(contrato)) throw new Error('el contrato OpenAPI debe ser un objeto')
  const rutas = contrato.paths ?? {}
  if (!esObjeto(rutas)) throw new Error('«paths» del contrato OpenAPI debe ser un objeto')
  const operaciones = []
  for (const [ruta, item] of Object.entries(rutas)) {
    if (item !== null && !esObjeto(item))
      throw new Error(`la ruta ${ruta} del contrato no es un objeto`)
    for (const metodo of Object.keys(item ?? {})) {
      if (METODOS.includes(metodo))
        operaciones.push(`${metodo.toUpperCase()} ${normalizarRuta(ruta)}`)
    }
  }
  return operaciones
}

function unirRuta(padre, hija) {
  return hija.startsWith('/') ? hija : `${padre.replace(/\/+$/, '')}/${hija}`
}

// Aplana el árbol del router: cada ruta anidada se une a la de su padre; una ruta índice (sin
// `path`) es la de su padre y no agrega otra.
export function rutasDePantalla(valor, padre = '') {
  if (!Array.isArray(valor)) throw new Error('las rutas de pantalla deben ser una lista')
  return valor.flatMap((ruta) => {
    if (typeof ruta === 'string') return [normalizarRuta(unirRuta(padre, ruta))]
    if (!esObjeto(ruta)) throw new Error('cada ruta de pantalla es un texto o un objeto')
    if (ruta.path !== undefined && typeof ruta.path !== 'string') {
      throw new Error('el «path» de una ruta de pantalla debe ser un texto')
    }
    const propia = ruta.path === undefined ? padre : unirRuta(padre, ruta.path)
    const hijas = ruta.children === undefined ? [] : rutasDePantalla(ruta.children, propia)
    return ruta.path === undefined ? hijas : [normalizarRuta(propia), ...hijas]
  })
}

function esArchivo(ruta) {
  return statSync(ruta, { throwIfNoEntry: false })?.isFile() ?? false
}

function problemasDeRecorrido(fila, raiz) {
  const archivos = fila.recorrido
    .split(',')
    .map((archivo) => archivo.trim())
    .filter(Boolean)
  if (archivos.length === 0) return [`sin recorrido: ${fila.entrada}`]
  return archivos.flatMap((archivo) => {
    const ruta = path.resolve(raiz, archivo)
    const relativa = path.relative(raiz, ruta)
    if (relativa === '..' || relativa.startsWith(`..${path.sep}`) || path.isAbsolute(relativa)) {
      return [`recorrido fuera del proyecto: ${fila.entrada} -> ${archivo}`]
    }
    return esArchivo(ruta) ? [] : [`recorrido inexistente: ${fila.entrada} -> ${archivo}`]
  })
}

function desfase(tipo, enElMapa, enElCodigo, etiquetaDelCodigo) {
  const mapa = new Set(enElMapa.filter((fila) => fila.tipo === tipo).map((fila) => fila.clave))
  const codigo = new Set(enElCodigo)
  const ordenadas = (claves) => [...claves].sort()
  return [
    ...ordenadas(codigo)
      .filter((clave) => !mapa.has(clave))
      .map((clave) => `falta en el mapa: ${clave}`),
    ...ordenadas(mapa)
      .filter((clave) => !codigo.has(clave))
      .map((clave) => `en el mapa sin ${etiquetaDelCodigo}: ${clave}`),
  ]
}

// Compara las filas con lo que expone el código. Sólo contrasta los tipos cuya fuente se pasó.
export function verificarMapa({ filas, operaciones = null, pantallas = null, raiz }) {
  const clasificadas = filas.map((fila) => ({
    ...fila,
    ...clasificar(fila.entrada),
  }))
  const problemas = []
  for (const fila of clasificadas) {
    if (!fila.entrada) problemas.push('fila sin entrada en el mapa')
    else problemas.push(...problemasDeRecorrido(fila, raiz))
  }
  if (operaciones)
    problemas.push(...desfase('http', clasificadas, operaciones, 'operación en OpenAPI'))
  if (pantallas) problemas.push(...desfase('pantalla', clasificadas, pantallas, 'ruta de pantalla'))
  return problemas
}

async function cargarRutas(archivo) {
  const ruta = path.resolve(archivo)
  if (ruta.endsWith('.json')) return rutasDePantalla(JSON.parse(readFileSync(ruta, 'utf8')))
  const modulo = await import(pathToFileURL(ruta).href)
  return rutasDePantalla(modulo.rutas)
}

async function principal() {
  const opciones = leerArgumentos(process.argv.slice(2))
  if (opciones.ayuda) {
    console.log(AYUDA)
    return 0
  }
  const filas = filasDelMapa(readFileSync(opciones.mapa, 'utf8'))
  const operaciones = opciones.openapi.length
    ? opciones.openapi.flatMap((archivo) =>
        operacionesOpenApi(JSON.parse(readFileSync(archivo, 'utf8'))),
      )
    : null
  const pantallas = opciones.rutas ? await cargarRutas(opciones.rutas) : null
  const problemas = verificarMapa({
    filas,
    operaciones,
    pantallas,
    raiz: process.cwd(),
  })
  for (const problema of problemas) console.error(problema)
  if (problemas.length === 0) console.log(`mapa al día: ${filas.length} filas`)
  return problemas.length ? 1 : 0
}

// Compara rutas reales: desde una carpeta enlazada (junction o symlink) import.meta.url ya viene
// resuelta y process.argv[1] no, y el chequeo se saltearía sin avisar.
function esElPrograma() {
  if (!process.argv[1]) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return false
  }
}

if (esElPrograma()) {
  principal().then(
    (codigo) => process.exit(codigo),
    (error) => {
      console.error(`${error.message}\n\n${AYUDA}`)
      process.exit(2)
    },
  )
}

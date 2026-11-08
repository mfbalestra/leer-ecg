#!/usr/bin/env node
// Compara el manifiesto de scripts de un proyecto contra el registro que su consola
// interactiva exporta (convencion de consola de proyecto, corrida desde la verificacion
// en un comando del piso operativo -- ver
// ~/.agents/skills/nuevo-proyecto/references/consola.md), para que ningun
// script quede sin registrar ni sin exclusion declarada. Node puro, sin dependencias,
// offline, portable (Windows y POSIX).
//
// Uso:
//   node check-consola.mjs --manifiesto package.json --registro <archivo.json>
//   node check-consola.mjs --manifiesto package.json --registro -   (lee el registro por stdin)
//
// El registro es el JSON que la propia consola exporta con su flag no interactivo
// (por convencion, --listar-json). El proyecto lo genera al vuelo en su script de
// verificacion, por ejemplo:
//   npm run operar -- --listar-json > .consola.json
//   node check-consola.mjs --manifiesto package.json --registro .consola.json
//
// Forma del registro:
//   {
//     "automatizaciones": [
//       { "script": "db:ping", "etiqueta": "...", "descripcion": "...", "destructiva": false }
//     ],
//     "excluidos": [
//       { "script": "dev", "motivo": "comando del ciclo de desarrollo, no automatizacion operativa" }
//     ]
//   }
//
// Manifiesto: por defecto se leen las claves de "scripts" de un package.json. Si el
// archivo pasado a --manifiesto no tiene esa forma, se acepta como fallback generico
// un JSON de lista plana de strings (["a", "b", "c"]) -- util para pyproject.toml u
// otro manifiesto ya volcado a esa forma antes de invocar este chequeo.
//
// Este archivo se copia al repo destino (por ejemplo a scripts/check-consola.mjs, o
// donde el stack del proyecto ponga sus chequeos) y se refresca copiando de nuevo
// desde aca -- no se edita a mano en el repo destino.

import { readFileSync } from 'node:fs'

function leerStdinSync() {
  try {
    return readFileSync(0, 'utf8')
  } catch (error) {
    throw new Error(
      `No se pudo leer el registro por stdin: ${error.message}. Si no estas encadenando un ` +
        'comando, pasa --registro <archivo.json> con una ruta en vez de "-".',
    )
  }
}

function ayuda() {
  return `check-consola.mjs -- coherencia entre el manifiesto de scripts y el registro de la consola

Uso:
  node check-consola.mjs --manifiesto <archivo> --registro <archivo.json>
  node check-consola.mjs --manifiesto <archivo> --registro -

Flags:
  --manifiesto <archivo>  Manifiesto del stack. Formas aceptadas:
                            - package.json: se leen las claves de "scripts".
                            - JSON de lista plana ["a","b",...]: fallback generico
                              para manifiestos que no son package.json.
  --registro <archivo|->  JSON exportado por la consola con su flag no interactivo
                            (--listar-json o el equivalente del proyecto). "-" lee
                            por stdin.
  --help, -h              Muestra esta ayuda y termina con salida 0.

Salida: clave=valor por secciones (== consola ==, == faltantes ==, == desconocidos ==,
== excluidos ==), cerrando con una linea final OK o FALLO. Sale 0 solo cuando no hay
faltantes, ni desconocidos, ni excluidos sin motivo.

Ejemplo:
  npm run operar -- --listar-json > .consola.json
  node check-consola.mjs --manifiesto package.json --registro .consola.json
`
}

function parsearArgs(argv) {
  const args = { manifiesto: null, registro: null, ayuda: false }
  for (let i = 0; i < argv.length; i++) {
    const actual = argv[i]
    if (actual === '--help' || actual === '-h') {
      args.ayuda = true
    } else if (actual === '--manifiesto') {
      args.manifiesto = argv[++i] ?? null
    } else if (actual === '--registro') {
      args.registro = argv[++i] ?? null
    }
  }
  return args
}

function leerJson(ruta, flagParaMostrar) {
  let crudo
  try {
    crudo = ruta === '-' ? leerStdinSync() : readFileSync(ruta, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `No existe el archivo "${ruta}" (buscado como ruta relativa al directorio actual). ` +
          `Revisa el valor pasado a ${flagParaMostrar}, o usa "-" para leer por stdin.`,
      )
    }
    throw error
  }
  try {
    return JSON.parse(crudo)
  } catch (error) {
    throw new Error(`"${ruta}" no es JSON valido para ${flagParaMostrar}: ${error.message}`)
  }
}

function scriptsDelManifiesto(manifiesto, ruta) {
  if (manifiesto && typeof manifiesto === 'object' && !Array.isArray(manifiesto)) {
    if (manifiesto.scripts && typeof manifiesto.scripts === 'object') {
      return Object.keys(manifiesto.scripts)
    }
  }
  if (Array.isArray(manifiesto) && manifiesto.every((item) => typeof item === 'string')) {
    return manifiesto
  }
  throw new Error(
    `"${ruta}" no tiene una forma reconocida para --manifiesto: se espera un package.json ` +
      'con un objeto "scripts", o (fallback generico) un JSON de lista plana de strings.',
  )
}

function normalizarRegistro(registro, ruta) {
  if (!registro || typeof registro !== 'object' || Array.isArray(registro)) {
    throw new Error(
      `"${ruta}" no tiene la forma esperada para --registro: se espera un objeto JSON.`,
    )
  }
  const automatizaciones = Array.isArray(registro.automatizaciones) ? registro.automatizaciones : []
  const excluidos = Array.isArray(registro.excluidos) ? registro.excluidos : []
  return { automatizaciones, excluidos }
}

function tieneMotivo(entrada) {
  return typeof entrada.motivo === 'string' && entrada.motivo.trim() !== ''
}

function evaluar({ manifiestoScripts, automatizaciones, excluidos }) {
  const registrados = new Set(automatizaciones.map((a) => a.script))
  const excluidosPorScript = new Map(excluidos.map((e) => [e.script, e]))

  const faltantes = manifiestoScripts.filter(
    (script) => !registrados.has(script) && !excluidosPorScript.has(script),
  )

  const enManifiesto = new Set(manifiestoScripts)
  const desconocidosSet = new Set()
  for (const script of registrados) {
    if (!enManifiesto.has(script)) desconocidosSet.add(script)
  }
  for (const script of excluidosPorScript.keys()) {
    if (!enManifiesto.has(script)) desconocidosSet.add(script)
  }

  const sinMotivo = excluidos.filter((e) => !tieneMotivo(e))

  return {
    registrados: automatizaciones.length,
    excluidosTotal: excluidos.length,
    faltantes,
    desconocidos: [...desconocidosSet],
    sinMotivo,
  }
}

function formatearReporte(resultado) {
  const lineas = []
  lineas.push('== consola ==')
  lineas.push(`registrados=${resultado.registrados}`)
  lineas.push(`excluidos=${resultado.excluidosTotal}`)
  lineas.push(`faltantes=${resultado.faltantes.length}`)
  lineas.push(`desconocidos=${resultado.desconocidos.length}`)
  lineas.push(`sin_motivo=${resultado.sinMotivo.length}`)
  lineas.push('')

  lineas.push('== faltantes ==')
  if (resultado.faltantes.length === 0) {
    lineas.push('omitidos=0')
  } else {
    for (const script of resultado.faltantes) lineas.push(`faltante=${script}`)
  }
  lineas.push('')

  lineas.push('== desconocidos ==')
  if (resultado.desconocidos.length === 0) {
    lineas.push('omitidos=0')
  } else {
    for (const script of resultado.desconocidos) lineas.push(`desconocido=${script}`)
  }
  lineas.push('')

  lineas.push('== excluidos ==')
  if (resultado.sinMotivo.length === 0) {
    lineas.push('omitidos=0')
  } else {
    for (const entrada of resultado.sinMotivo) lineas.push(`sin_motivo=${entrada.script}`)
  }
  lineas.push('')

  const ok =
    resultado.faltantes.length === 0 &&
    resultado.desconocidos.length === 0 &&
    resultado.sinMotivo.length === 0
  lineas.push(ok ? 'OK' : 'FALLO')
  return { texto: lineas.join('\n'), ok }
}

function principal() {
  const args = parsearArgs(process.argv.slice(2))

  if (args.ayuda) {
    process.stdout.write(ayuda())
    process.exit(0)
  }

  if (!args.manifiesto || !args.registro) {
    process.stderr.write(
      'Faltan flags requeridos: --manifiesto <archivo> y --registro <archivo.json|->.\n\n' +
        ayuda(),
    )
    process.exit(2)
  }

  let manifiestoScripts
  let registro
  try {
    const manifiestoCrudo = leerJson(args.manifiesto, '--manifiesto')
    manifiestoScripts = scriptsDelManifiesto(manifiestoCrudo, args.manifiesto)
    const registroCrudo = leerJson(args.registro, '--registro')
    registro = normalizarRegistro(registroCrudo, args.registro)
  } catch (error) {
    process.stderr.write(`ERROR=${error.message}\n`)
    process.exit(2)
  }

  const resultado = evaluar({
    manifiestoScripts,
    automatizaciones: registro.automatizaciones,
    excluidos: registro.excluidos,
  })
  const { texto, ok } = formatearReporte(resultado)
  process.stdout.write(texto + '\n')
  process.exit(ok ? 0 : 1)
}

principal()

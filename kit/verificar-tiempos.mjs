#!/usr/bin/env node
// Corre los tests del proyecto (scripts.test de package.json, un solo `vitest run`) y falla cuando un
// archivo tarda más que el tope. Las excepciones fechadas viven en tests-lentos.json, en la raíz.
//
// Uso: node kit/verificar-tiempos.mjs [--tope <s>] [--hoy YYYY-MM-DD]
//
// Los segundos de cada archivo salen del reporte junit de Vitest: un <testsuite> por archivo, con su
// `time`. Un archivo sobre el tope que no figura en la lista se vuelve a correr solo una vez; falla
// únicamente si sigue sobre el tope.
// tests-lentos.json: [{ "archivo": "src/x.test.ts", "motivo": "...", "fecha": "AAAA-MM-DD" }]. Un
// archivo listado tiene que existir y su entrada vence a los 30 días.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const TOPE_SEGUNDOS = 20
export const VIGENCIA_DIAS = 30

const OPERADORES = new Set(['&&', '||', '|', ';', '<', '>'])

// Argumentos que scripts.test le da a `vitest run`, sin las comillas del shell.
export function argumentosDeTest(textoPackage) {
  const comando = JSON.parse(textoPackage).scripts?.test ?? ''
  const partes = (comando.match(/(?:"[^"]*"|\S)+/g) ?? []).map((parte) => parte.replaceAll('"', ''))
  if (partes[0] !== 'vitest' || partes[1] !== 'run')
    throw new Error('scripts.test debe empezar con "vitest run"')
  if (partes.some((parte) => OPERADORES.has(parte)))
    throw new Error('scripts.test debe ser un solo "vitest run", sin encadenar comandos')
  return partes.slice(2)
}

const ENTIDADES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }
const atributo = (texto, nombre) => {
  const m = new RegExp(`\\s${nombre}="([^"]*)"`).exec(texto)
  return m ? m[1].replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTIDADES[e]) : null
}

// Mapa de archivo (relativo a `raiz`, con /) a segundos, desde el texto junit.
export function segundosPorArchivo(xml, raiz) {
  const resultado = new Map()
  for (const m of xml.matchAll(/<testsuite\b((?:"[^"]*"|[^">])*)>/g)) {
    const nombre = atributo(m[1], 'name')
    if (!nombre) continue
    const relativo = path.relative(raiz, path.resolve(raiz, nombre)).split(path.sep).join('/')
    resultado.set(relativo, (resultado.get(relativo) ?? 0) + (Number(atributo(m[1], 'time')) || 0))
  }
  return resultado
}

const dias = (iso) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000

// `existe(archivo)` dice si el archivo listado sigue en el proyecto.
export function validarLentos(lentos, existe, hoy) {
  const fallas = []
  for (const { archivo, fecha } of lentos) {
    if (!existe(archivo)) fallas.push(`lista de lentos obsoleta: ${archivo} no existe`)
    else if (!(dias(hoy) - dias(fecha) <= VIGENCIA_DIAS))
      fallas.push(`lista de lentos vencida: ${archivo} (${fecha}, más de ${VIGENCIA_DIAS} días)`)
  }
  return fallas
}

// `medirSolo(archivo)` devuelve los segundos de una corrida sola.
export function decidir({ segundos, tope, lentos, medirSolo }) {
  const lineas = []
  let lentosTolerados = 0
  let fallas = 0
  const listados = new Set(lentos.map((e) => e.archivo))
  for (const [archivo, paralelo] of [...segundos].sort((a, b) => b[1] - a[1])) {
    if (paralelo <= tope) continue
    if (listados.has(archivo)) {
      lentosTolerados += 1
      continue
    }
    const solo = medirSolo(archivo)
    const falla = solo > tope
    if (falla) fallas += 1
    lineas.push(
      `archivo=${archivo} paralelo=${paralelo.toFixed(1)}s solo=${solo.toFixed(1)}s tope=${tope}s resultado=${falla ? 'falla' : 'ok'}`,
    )
  }
  return { lineas, fallas, lentosTolerados }
}

function esEntrada(urlModulo) {
  const entrada = process.argv[1]
  if (!entrada) return false
  const propio = fileURLToPath(urlModulo)
  try {
    return realpathSync.native(entrada) === realpathSync.native(propio)
  } catch {
    return path.resolve(entrada) === path.resolve(propio)
  }
}

export function principal(argv = process.argv.slice(2), raiz = process.cwd()) {
  const valor = (nombre) => (argv.includes(nombre) ? argv[argv.indexOf(nombre) + 1] : null)
  const tope = Number(valor('--tope') ?? TOPE_SEGUNDOS)
  const hoy = valor('--hoy') ?? new Date().toISOString().slice(0, 10)
  const argumentos = argumentosDeTest(readFileSync(path.join(raiz, 'package.json'), 'utf8'))
  const vitest = path.join(raiz, 'node_modules', 'vitest', 'vitest.mjs')
  if (!existsSync(vitest)) throw new Error('falta node_modules/vitest: instalar las dependencias')
  const lentos = JSON.parse(readFileSync(path.join(raiz, 'tests-lentos.json'), 'utf8'))
  const fallasLista = validarLentos(lentos, (archivo) => existsSync(path.join(raiz, archivo)), hoy)
  fallasLista.forEach((f) => console.log(f))

  const carpeta = mkdtempSync(path.join(tmpdir(), 'tiempos-'))
  const reporte = path.join(carpeta, 'reporte.xml')
  try {
    const corrida = spawnSync(
      process.execPath,
      [
        vitest,
        'run',
        ...argumentos,
        '--reporter=default',
        '--reporter=junit',
        `--outputFile.junit=${reporte}`,
      ],
      { cwd: raiz, stdio: 'inherit' },
    )
    let segundos = new Map()
    try {
      segundos = segundosPorArchivo(readFileSync(reporte, 'utf8'), raiz)
    } catch {
      /* la corrida murió antes de escribirlo */
    }
    const medirSolo = (archivo) => {
      const inicio = Date.now()
      spawnSync(process.execPath, [vitest, 'run', archivo], { cwd: raiz, stdio: 'ignore' })
      return (Date.now() - inicio) / 1000
    }
    const { lineas, fallas, lentosTolerados } = decidir({ segundos, tope, lentos, medirSolo })
    lineas.forEach((l) => console.log(l))
    const pruebasFallan = corrida.status !== 0
    if (pruebasFallan) console.log(`tests=falla estado=${corrida.status ?? corrida.signal}`)
    const total = fallas + fallasLista.length + (pruebasFallan ? 1 : 0)
    console.log(
      `tiempos=${total ? 'falla' : 'ok'} medidos=${segundos.size} lentos_listados=${lentosTolerados} lentos_sin_lista=${fallas} lista_invalida=${fallasLista.length} tope=${tope}s`,
    )
    process.exitCode = total ? 1 : 0
  } finally {
    rmSync(carpeta, { recursive: true, force: true })
  }
}

if (esEntrada(import.meta.url)) principal()

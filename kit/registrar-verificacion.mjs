#!/usr/bin/env node
// Records that a full verification passed on the working tree it started on, and reads that record back.
//
// Usage, as the first and the last step of the verification command (the last runs only when every
// earlier step passed):
//   node <path>/registrar-verificacion.mjs --inicio "npm run check"    first step: takes the tree's fingerprint
//   node <path>/registrar-verificacion.mjs "npm run check"             last step: confirms it
// Inspection:
//   node <path>/registrar-verificacion.mjs --leer     the record of this folder
//   node <path>/registrar-verificacion.mjs --huella   huella=<sha256> of the current tree
// Tests pass `--carpeta <dir>` to keep their records out of the real folder.
//
// The record lives outside the repository, under <tmpdir>/agentes-verificacion/<hash of the folder>.json,
// where the folder is the one the command runs in (its real path, forward slashes, lower-cased on Windows);
// the fingerprint covers the Git repository that holds that folder. One entry per command:
// { "<command>": { "huella": "<sha256>", "hora": "<ISO>", "raiz": "<Git root>", "proyecto": "<folder>",
// "pendiente": { "huella": "<sha256>", "hora": "<ISO>" } } }. `huella` and `hora` are the last green run;
// `pendiente` is a run in progress.
//
// The two steps: `--inicio` stores the fingerprint of the tree as the run starts under `pendiente`, leaving
// any green `huella` and `hora` as they are. The closing call writes `huella` and `hora` only when a
// `pendiente` exists and its fingerprint equals the one of the tree now, so edits made while the run went
// on are never recorded as verified; it removes `pendiente` in every case and prints `registro=escrito`, or
// `registro=omitido` with `motivo=sin inicio` or `motivo=el árbol cambió durante la corrida`. Both exit 0.
// The long-runs guardian of the shared agent base reads the record before a shell command runs that same
// command: with the same fingerprint as `huella` it denies the repeat, naming when it passed. Any change to
// the tree, a record of another command or no record at all lets the run go.
//
// Fingerprint (the kit's copies, kit/registrar-verificacion.mjs and registrar_verificacion.py, compute
// the same one): sha256, hex, of the UTF-8 text «<HEAD>\n<lines>», where HEAD is the commit id
// (`sin-commits` before the first commit) and each line is `<XY>\t<path>\t<blob>`, one per entry of
// `git status --porcelain=v1 -uall -z` (the new path of a rename or copy; its original path is dropped),
// with <blob> the id `git hash-object` gives the file in the working tree, or `borrado` when no regular
// file is there; lines sorted as plain strings and joined with \n. Ignored files never enter.
// Self-contained on purpose: Node builtins only, so the kit can copy it byte for byte.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const sha256 = (texto) => createHash('sha256').update(texto, 'utf8').digest('hex')

function git(raiz, args, entrada) {
  return execFileSync(
    'git',
    ['-C', raiz, '--no-optional-locks', '-c', 'core.fsmonitor=false', ...args],
    {
      encoding: 'utf8',
      input: entrada ?? '',
      stdio: ['pipe', 'pipe', 'ignore'],
      maxBuffer: 256 * 1024 * 1024,
      windowsHide: true,
    },
  )
}

// Root of the repository that holds `cwd`, with forward slashes, or null outside a repository.
export function raizDe(cwd = process.cwd()) {
  try {
    return git(cwd, ['rev-parse', '--show-toplevel']).trim().replaceAll('\\', '/')
  } catch {
    return null
  }
}

// The key of a folder: its real path, forward slashes, no trailing slash, lower-cased where paths are.
function claveDeCarpeta(carpeta) {
  let real = path.resolve(carpeta)
  try {
    real = realpathSync.native(real)
  } catch {
    /* a folder that is gone keeps its spelling */
  }
  real = real.replaceAll('\\', '/').replace(/\/+$/, '')
  return process.platform === 'win32' ? real.toLowerCase() : real
}

// Entries of `git status --porcelain=v1 -uall -z`: { xy, ruta }, keeping a rename's new path only.
export function entradasDeEstado(salidaZ) {
  const partes = salidaZ.split('\0')
  const entradas = []
  for (let i = 0; i < partes.length; i += 1) {
    const parte = partes[i]
    if (parte.length < 4) continue
    const xy = parte.slice(0, 2)
    if (xy[0] === 'R' || xy[0] === 'C') i += 1
    entradas.push({ xy, ruta: parte.slice(3) })
  }
  return entradas
}

const esArchivo = (ruta) => {
  try {
    return statSync(ruta).isFile()
  } catch {
    return false
  }
}

export function huellaArbol(raiz) {
  let head
  try {
    head = git(raiz, ['rev-parse', '--verify', 'HEAD']).trim()
  } catch {
    head = 'sin-commits'
  }
  const entradas = entradasDeEstado(git(raiz, ['status', '--porcelain=v1', '-uall', '-z']))
  const presentes = entradas.filter((e) => esArchivo(path.join(raiz, e.ruta)))
  const blobs = presentes.length
    ? git(raiz, ['hash-object', '--stdin-paths'], `${presentes.map((e) => e.ruta).join('\n')}\n`)
        .trim()
        .split('\n')
    : []
  const blobPorRuta = new Map(presentes.map((e, i) => [e.ruta, blobs[i]]))
  const lineas = entradas
    .map((e) => `${e.xy}\t${e.ruta}\t${blobPorRuta.get(e.ruta) ?? 'borrado'}`)
    .sort()
  return sha256(`${head}\n${lineas.join('\n')}`)
}

export const carpetaRegistros = () => path.join(tmpdir(), 'agentes-verificacion')

export function rutaRegistro(proyecto, carpeta = carpetaRegistros()) {
  return path.join(carpeta, `${sha256(claveDeCarpeta(proyecto)).slice(0, 32)}.json`)
}

export function leerRegistro(proyecto, carpeta = carpetaRegistros()) {
  try {
    const registro = JSON.parse(readFileSync(rutaRegistro(proyecto, carpeta), 'utf8'))
    return registro && typeof registro === 'object' && !Array.isArray(registro) ? registro : {}
  } catch {
    return {}
  }
}

function escribirRegistro(proyecto, carpeta, registro) {
  mkdirSync(carpeta, { recursive: true })
  writeFileSync(rutaRegistro(proyecto, carpeta), `${JSON.stringify(registro, null, 2)}\n`)
}

// First step of a run: the fingerprint of the tree as it is now, kept as the run in progress. Null outside Git.
export function iniciar(proyecto, comando, carpeta = carpetaRegistros(), ahora = new Date()) {
  const raiz = raizDe(proyecto)
  if (!raiz) return null
  const registro = leerRegistro(proyecto, carpeta)
  const pendiente = { huella: huellaArbol(raiz), hora: ahora.toISOString() }
  registro[comando] = { ...registro[comando], raiz, proyecto: claveDeCarpeta(proyecto), pendiente }
  escribirRegistro(proyecto, carpeta, registro)
  return pendiente
}

// Last step: { entrada } when the tree is the one the run started on, { motivo } when it is not or when
// nothing started; the run in progress is cleared either way. Null outside Git.
export function registrar(proyecto, comando, carpeta = carpetaRegistros(), ahora = new Date()) {
  const raiz = raizDe(proyecto)
  if (!raiz) return null
  const registro = leerRegistro(proyecto, carpeta)
  const { pendiente, ...previo } = registro[comando] ?? {}
  const huella = typeof pendiente?.huella === 'string' ? huellaArbol(raiz) : null
  let resultado
  if (huella === null) resultado = { motivo: 'sin inicio' }
  else if (huella !== pendiente.huella) resultado = { motivo: 'el árbol cambió durante la corrida' }
  else {
    const entrada = { huella, hora: ahora.toISOString(), raiz, proyecto: claveDeCarpeta(proyecto) }
    registro[comando] = entrada
    resultado = { entrada }
  }
  if (!resultado.entrada) {
    if (typeof previo.huella === 'string') registro[comando] = previo
    else delete registro[comando]
  }
  if (pendiente !== undefined || resultado.entrada) escribirRegistro(proyecto, carpeta, registro)
  return resultado
}

// The record of `comando` when the tree is still the one it passed on; null otherwise.
export function verdeVigente(proyecto, comando, carpeta = carpetaRegistros()) {
  const raiz = raizDe(proyecto)
  if (!raiz) return null
  const entrada = leerRegistro(proyecto, carpeta)[comando]
  if (!entrada || typeof entrada.huella !== 'string') return null
  return entrada.huella === huellaArbol(raiz) ? entrada : null
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

function principal(argv) {
  let carpeta = carpetaRegistros()
  let leer = false
  let huella = false
  let inicio = null
  const positivos = []
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--carpeta') {
      carpeta = argv[i + 1] ?? carpeta
      i += 1
    } else if (argv[i] === '--inicio') {
      inicio = argv[i + 1] ?? ''
      i += 1
    } else if (argv[i] === '--leer') leer = true
    else if (argv[i] === '--huella') huella = true
    else positivos.push(argv[i])
  }
  const proyecto = process.cwd()
  const raiz = raizDe(proyecto)
  if (!raiz) {
    console.log('registro=omitido motivo=no es un repositorio Git')
    return
  }
  if (huella) {
    console.log(`huella=${huellaArbol(raiz)}`)
    return
  }
  if (leer) {
    console.log(JSON.stringify(leerRegistro(proyecto, carpeta), null, 2))
    return
  }
  const comando = (inicio ?? positivos[0])?.trim()
  if (!comando) {
    console.error(
      'uso: registrar-verificacion.mjs [--inicio] "<comando>" [--carpeta <dir>] | --leer | --huella',
    )
    process.exitCode = 2
    return
  }
  const archivo = rutaRegistro(proyecto, carpeta)
  if (inicio !== null) {
    const pendiente = iniciar(proyecto, comando, carpeta)
    console.log(
      `registro=inicio comando=${comando} huella=${pendiente.huella.slice(0, 12)} archivo=${archivo}`,
    )
    return
  }
  const { entrada, motivo } = registrar(proyecto, comando, carpeta)
  if (entrada) {
    console.log(
      `registro=escrito comando=${comando} huella=${entrada.huella.slice(0, 12)} archivo=${archivo}`,
    )
  } else {
    console.log(`registro=omitido motivo=${motivo}`)
  }
}

if (esEntrada(import.meta.url)) principal(process.argv.slice(2))

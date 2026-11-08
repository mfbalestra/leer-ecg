#!/usr/bin/env node
import { realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { crearConsola } from './motor.mjs'
import { registro } from './registro.mjs'

export const raiz = path.dirname(fileURLToPath(import.meta.url))
const consola = crearConsola({
  registro,
  raiz,
  titulo: 'Consola de leer-ecg',
  invocacion: 'node operar.mjs',
})
export const { prepararComando, ejecutarProceso, ejecutarEntrada, ayuda, menu, principal } = consola

function isEntryPoint() {
  const entry = process.argv[1]
  if (!entry) return false
  const self = fileURLToPath(import.meta.url)
  try {
    // Ruta real de ambos lados: la skill se invoca también a través de la junction ~/.claude/skills.
    // Copia propia de skills/compartido/scripts/entrada.mjs: esta consola se copia a cada proyecto.
    return realpathSync.native(entry) === realpathSync.native(self)
  } catch {
    return path.resolve(entry) === path.resolve(self)
  }
}

if (isEntryPoint()) {
  try {
    process.exitCode = await principal(process.argv.slice(2))
  } catch (error) {
    console.error(`ERROR: ${error.message}`)
    process.exitCode = 1
  }
}

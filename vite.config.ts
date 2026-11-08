import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Versión, commit y fecha del build: se leen una vez al compilar, nunca en tiempo de ejecución. */
function datosDeVersion(): { version: string; commit: string; fecha: string } {
  const manifiesto = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }
  let commit = 'sin-git'
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    // Un build fuera de un clon (un zip) queda sin commit, pero compila.
  }
  // eslint-disable-next-line propias/hora-desde-el-reloj -- es la fecha del build, estampada al compilar; no corre en la app
  return { version: manifiesto.version, commit, fecha: new Date().toISOString() }
}

/** Escribe `version.json` en el build, para leerlo en `/version.json` del sitio publicado. */
function versionJson(datos: ReturnType<typeof datosDeVersion>): Plugin {
  return {
    name: 'leer-ecg-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(datos, null, 2),
      })
    },
  }
}

const version = datosDeVersion()

export default defineConfig({
  // Rutas relativas: el sitio se publica bajo /leer-ecg/ en GitHub Pages y también sirve en la raíz.
  base: './',
  plugins: [react(), tailwindcss(), versionJson(version)],
  define: {
    __VERSION__: JSON.stringify(`${version.version} (${version.commit})`),
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})

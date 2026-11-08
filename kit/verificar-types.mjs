import { readFileSync } from 'node:fs'
import path from 'node:path'

// Compara la mayor declarada de cada @types/<paquete> contra la mayor declarada del paquete que
// tipa, leyendo solo package.json: corre offline, sin node_modules ni consulta al registry.
const rutaManifiesto = path.join(process.cwd(), 'package.json')

let manifiesto
try {
  manifiesto = JSON.parse(readFileSync(rutaManifiesto, 'utf8'))
} catch (error) {
  console.error(`no se pudo leer ${rutaManifiesto}: ${error.message}`)
  process.exit(2)
}

const dependencias = { ...manifiesto.dependencies, ...manifiesto.devDependencies }

// Convención DefinitelyTyped: @types/a__b tipa el paquete con scope @a/b.
function paqueteHomonimo(nombreTypes) {
  const indice = nombreTypes.indexOf('__')
  if (indice === -1) return nombreTypes
  return `@${nombreTypes.slice(0, indice)}/${nombreTypes.slice(indice + 2)}`
}

// Solo reconoce el rango entero como ^X.Y.Z, ~X.Y.Z o X.Y.Z (ancla principio y final). Cualquier
// otra forma (*, latest, URL, OR, guion, rango sin número inicial) devuelve null; esa comparación
// se informa como no comparable, sin fallar.
function extraerMayor(rango) {
  if (typeof rango !== 'string') return null
  const texto = rango.trim()
  const coincidencia = /^[~^]?(\d+)\.\d+\.\d+$/.exec(texto)
  return coincidencia ? coincidencia[1] : null
}

let desalineado = false

for (const [nombre, rango] of Object.entries(dependencias)) {
  if (!nombre.startsWith('@types/')) continue
  const homonimo = paqueteHomonimo(nombre.slice('@types/'.length))
  const rangoHomonimo = dependencias[homonimo]
  if (rangoHomonimo === undefined) continue

  const mayorTypes = extraerMayor(rango)
  const mayorPaquete = extraerMayor(rangoHomonimo)
  if (mayorTypes === null || mayorPaquete === null) {
    if (mayorTypes === null) {
      console.error(`${homonimo}: no comparable, ${nombre} declara el rango ${rango}`)
    }
    if (mayorPaquete === null) {
      console.error(`${homonimo}: no comparable, ${homonimo} declara el rango ${rangoHomonimo}`)
    }
    continue
  }

  if (mayorTypes !== mayorPaquete) {
    console.error(
      `${homonimo}: ${nombre} declara la mayor ${mayorTypes} y ${homonimo} declara la mayor ${mayorPaquete}`,
    )
    desalineado = true
  }
}

process.exit(desalineado ? 1 : 0)

import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { crearAzar } from './azar.ts'
import { contarQrs, ritmoTieneP } from './latido.ts'
import { MS_POR_CUADRADO_GRANDE, SECUENCIA_300, cuadradosChicos } from './papel.ts'
import {
  NIVELES,
  TIPOS_POR_NIVEL,
  esCorrecta,
  generarLectura,
  generarReto,
  type NivelId,
  type Reto,
  type TipoReto,
  type TipoRitmoIntervalo,
} from './retos.ts'
import { juzgarPr, juzgarQrs } from './valores.ts'

const semillas = fc.integer({ min: 0, max: 2 ** 31 - 1 })

const nivelesConTipos: { nivel: NivelId; tipo: TipoReto }[] = NIVELES.filter(
  (n) => n.id !== 'lectura',
).flatMap((n) => TIPOS_POR_NIVEL[n.id].map((tipo) => ({ nivel: n.id, tipo })))

/** La respuesta correcta está entre lo que se ofrece, y `esCorrecta` la reconoce. */
function respuestaCoherente(reto: Reto): boolean {
  const r = reto.respuesta
  switch (r.modo) {
    case 'opciones':
      return r.opciones.some((o) => o.id === r.correcta) && esCorrecta(reto, r.correcta)
    case 'zona':
      return r.zonas.some((z) => z.id === r.correcta) && esCorrecta(reto, r.correcta)
    case 'conteo':
      return r.correcta >= r.minimo && r.correcta <= r.maximo && esCorrecta(reto, r.correcta)
  }
}

describe('generarReto', () => {
  it('todo reto de todo nivel tiene su respuesta entre lo ofrecido y textos no vacíos', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nivelesConTipos), semillas, ({ nivel, tipo }, semilla) => {
        const reto = generarReto(nivel, tipo, crearAzar(semilla), 1)
        return (
          reto.tipo === tipo &&
          respuestaCoherente(reto) &&
          reto.enunciado.length > 0 &&
          reto.acierto.length > 0 &&
          reto.error.length > 0
        )
      }),
    )
  })

  it('una respuesta equivocada nunca se acepta', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nivelesConTipos), semillas, ({ nivel, tipo }, semilla) => {
        const reto = generarReto(nivel, tipo, crearAzar(semilla), 1)
        const r = reto.respuesta
        if (r.modo === 'conteo') return !esCorrecta(reto, r.correcta + 1)
        const otras = (r.modo === 'opciones' ? r.opciones : r.zonas).filter(
          (o) => o.id !== r.correcta,
        )
        return otras.every((o) => !esCorrecta(reto, o.id))
      }),
    )
  })

  it('la regla del 300: las R marcadas distan exactamente los cuadrados que se preguntan', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const reto = generarReto('frecuencia', 'frecuencia-regla-300', crearAzar(semilla), 1)
        const lineas = reto.marcas.filter((m) => m.tipo === 'linea')
        const [a, b] = lineas
        if (!a || !b || a.tipo !== 'linea' || b.tipo !== 'linea') return false
        const cuadrados = (b.enMs - a.enMs) / MS_POR_CUADRADO_GRANDE
        const lpm = 300 / cuadrados
        return (
          Math.abs(cuadrados - Math.round(cuadrados)) < 1e-6 &&
          reto.respuesta.modo === 'opciones' &&
          reto.respuesta.correcta === String(lpm) &&
          SECUENCIA_300.some((s) => s === lpm)
        )
      }),
    )
  })

  it('contar cuadrados grandes: la respuesta es la distancia real entre las R marcadas', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const reto = generarReto('frecuencia', 'frecuencia-contar-grandes', crearAzar(semilla), 1)
        const [a, b] = reto.marcas
        if (
          !a ||
          !b ||
          a.tipo !== 'linea' ||
          b.tipo !== 'linea' ||
          reto.respuesta.modo !== 'conteo'
        )
          return false
        return Math.abs((b.enMs - a.enMs) / MS_POR_CUADRADO_GRANDE - reto.respuesta.correcta) < 1e-6
      }),
    )
  })

  it('contar QRS en 6 segundos: la respuesta es lo que la tira dibuja en la ventana', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const reto = generarReto('frecuencia', 'frecuencia-contar-qrs', crearAzar(semilla), 1)
        if (reto.vista.tipo !== 'tira' || reto.respuesta.modo !== 'conteo') return false
        return reto.respuesta.correcta === contarQrs(reto.vista.tira, 0, 6000)
      }),
    )
  })

  it('medir y juzgar PR y QRS salen de los parámetros del latido dibujado', () => {
    fc.assert(
      fc.property(
        semillas,
        fc.constantFrom<TipoRitmoIntervalo>(
          'ritmo-medir-pr',
          'ritmo-juzgar-pr',
          'ritmo-medir-qrs',
          'ritmo-juzgar-qrs',
        ),
        (semilla, tipo) => {
          const reto = generarReto('ritmo', tipo, crearAzar(semilla), 1)
          if (reto.vista.tipo !== 'latido') return false
          const { prMs, qrsMs } = reto.vista.latido.parametros
          const r = reto.respuesta
          switch (tipo) {
            case 'ritmo-medir-pr':
              return r.modo === 'conteo' && r.correcta === cuadradosChicos(prMs)
            case 'ritmo-juzgar-pr':
              return r.modo === 'opciones' && r.correcta === juzgarPr(prMs)
            case 'ritmo-medir-qrs':
              return r.modo === 'conteo' && r.correcta === cuadradosChicos(qrsMs)
            case 'ritmo-juzgar-qrs':
              return r.modo === 'opciones' && r.correcta === juzgarQrs(qrsMs)
          }
        },
      ),
    )
  })

  it('ritmo: regular e irregular y la P responden al ritmo real de la tira', () => {
    fc.assert(
      fc.property(
        semillas,
        fc.constantFrom<TipoReto>('ritmo-regular', 'ritmo-p'),
        (semilla, tipo) => {
          const reto = generarReto('ritmo', tipo, crearAzar(semilla), 1)
          if (reto.vista.tipo !== 'tira' || reto.respuesta.modo !== 'opciones') return false
          const ritmo = reto.vista.tira.ritmo
          if (tipo === 'ritmo-regular') {
            return reto.respuesta.correcta === (ritmo === 'regular' ? 'regular' : 'irregular')
          }
          return reto.respuesta.correcta === (ritmoTieneP(ritmo) ? 'si' : 'no')
        },
      ),
    )
  })

  it('las zonas para tocar no se superponen y van en orden', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const reto = generarReto('latido', 'latido-tocar', crearAzar(semilla), 1)
        if (reto.respuesta.modo !== 'zona') return false
        const zonas = reto.respuesta.zonas
        for (let i = 1; i < zonas.length; i += 1) {
          const a = zonas[i - 1]
          const b = zonas[i]
          if (!a || !b || a.hastaMs > b.desdeMs) return false
        }
        return zonas.every((z) => z.hastaMs > z.desdeMs)
      }),
    )
  })
})

describe('generarLectura', () => {
  it('arma una lectura ordenada sobre la misma tira, con las preguntas coherentes', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const retos = generarLectura(crearAzar(semilla), 1)
        const tiras = new Set(
          retos
            .filter((r) => r.vista.tipo === 'tira')
            .map((r) => (r.vista.tipo === 'tira' ? r.vista.tira.id : '')),
        )
        const tira = retos.find((r) => r.vista.tipo === 'tira')?.vista
        if (tira?.tipo !== 'tira') return false
        const ritmo = tira.tira.ritmo
        const preguntaPr = retos.some((r) => r.tipo === 'ritmo-juzgar-pr')
        // Ningún enunciado de la lectura dice una medida: la persona cuenta sobre la tira.
        const sinMedidas = retos.every((r) => !/\d+ (ms|cuadrados)/.test(r.enunciado))
        const frecuencia = retos[1]?.tipo
        return (
          retos.length >= 4 &&
          retos.length <= 5 &&
          tiras.size === 1 &&
          retos[0]?.tipo === 'ritmo-regular' &&
          frecuencia === (ritmo === 'regular' ? 'frecuencia-regla-300' : 'frecuencia-contar-qrs') &&
          preguntaPr === ritmoTieneP(ritmo) &&
          sinMedidas &&
          retos.every((r) => r.nivel === 'lectura' && respuestaCoherente(r))
        )
      }),
    )
  })

  it('en la lectura, el PR y el QRS se juzgan contando: el enunciado no dice la medida', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const retos = generarLectura(crearAzar(semilla), 1)
        return retos
          .filter((r) => r.tipo === 'ritmo-juzgar-pr' || r.tipo === 'ritmo-juzgar-qrs')
          .every(
            (r) =>
              r.enunciado.includes('Contá los cuadrados chicos') &&
              r.marcas.every((m) => m.etiqueta === 'PR' || m.etiqueta === 'QRS'),
          )
      }),
    )
  })
})

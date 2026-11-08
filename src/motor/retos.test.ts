import * as fc from 'fast-check'
import { describe, it } from 'vitest'

import { crearAzar } from './azar.ts'
import { numero, segundos } from './formato.ts'
import { contarQrs, latidosVisibles, ritmoTieneP, type Tira } from './latido.ts'
import { MS_POR_CUADRADO_GRANDE, SECUENCIA_300, cuadradosChicos } from './papel.ts'
import {
  NIVELES,
  TIPOS_POR_NIVEL,
  esCorrecta,
  generarLectura,
  generarReto,
  type Marca,
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

// ---------------------------------------------------------------------------------------------
// Evidencia: lo que se dibuja al responder cuenta lo mismo que la respuesta y sale de los latidos
// que dibujan la tira.

type Tramo = Extract<Marca, { tipo: 'tramo' }>
const tramos = (marcas: readonly Marca[]) => marcas.filter((m): m is Tramo => m.tipo === 'tramo')
const cerca = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** Los cuadrados numerados empiezan en la primera R, miden un cuadrado grande cada uno, van
 * pegados y terminan en la segunda R; su cantidad es la que se pregunta. */
function cuadradosCoherentes(reto: Reto, cuadrados: number): boolean {
  const lineas = reto.marcas.filter((m) => m.tipo === 'linea')
  const [a, b] = lineas
  const numerados = tramos(reto.evidencia)
  if (!a || !b || a.tipo !== 'linea' || b.tipo !== 'linea') return false
  return (
    numerados.length === cuadrados &&
    numerados.length === reto.evidencia.length &&
    numerados.every(
      (t, i) =>
        t.etiqueta === numero(i + 1) &&
        cerca(t.hastaMs - t.desdeMs, MS_POR_CUADRADO_GRANDE) &&
        cerca(t.desdeMs, i === 0 ? a.enMs : (numerados[i - 1]?.hastaMs ?? Number.NaN)),
    ) &&
    cerca(numerados.at(-1)?.hastaMs ?? Number.NaN, b.enMs)
  )
}

/** Cada QRS de la ventana numerado sobre su R, en orden; el último número es el conteo. */
function qrsCoherentes(reto: Reto, tira: Tira): boolean {
  if (reto.respuesta.modo !== 'conteo') return false
  const correcta = reto.respuesta.correcta
  const rotulos = reto.evidencia.filter((m) => m.tipo === 'rotulo')
  const erres = tira.latidos.filter((l) => l.rMs >= 0 && l.rMs <= 6000).map((l) => l.rMs)
  return (
    rotulos.length === reto.evidencia.length &&
    rotulos.length === correcta &&
    (correcta === 0 || rotulos.at(-1)?.etiqueta === numero(correcta)) &&
    rotulos.every((m, i) => m.etiqueta === numero(i + 1) && cerca(m.enMs, erres[i] ?? Number.NaN))
  )
}

/** Cada R visible marcada y cada distancia R–R sombreada, pegadas; iguales sólo si es regular. */
function rrCoherentes(reto: Reto, tira: Tira): boolean {
  const visibles = latidosVisibles(tira)
  const erres = reto.evidencia.filter((m) => m.tipo === 'linea')
  const distancias = tramos(reto.evidencia)
  const anchos = distancias.map((t) => t.hastaMs - t.desdeMs)
  const iguales = anchos.every((w) => cerca(w, anchos[0] ?? Number.NaN))
  return (
    erres.length === visibles.length &&
    erres.every((m, i) => m.tipo === 'linea' && cerca(m.enMs, visibles[i]?.rMs ?? Number.NaN)) &&
    distancias.length === visibles.length - 1 &&
    distancias.every(
      (t, i) =>
        cerca(t.desdeMs, visibles[i]?.rMs ?? Number.NaN) &&
        cerca(t.hastaMs, visibles[i + 1]?.rMs ?? Number.NaN) &&
        t.etiqueta === segundos((t.hastaMs - t.desdeMs) / 1000) &&
        t.omitible,
    ) &&
    iguales === (tira.ritmo === 'regular')
  )
}

/** Una marca de P por latido visible cuya P entra en el papel, antes de su QRS: «P» si el ritmo
 * tiene P, «sin P» si no. */
function pCoherentes(reto: Reto, tira: Tira): boolean {
  const conP = latidosVisibles(tira).filter((l) => l.pFinMs > 0)
  const marcas = tramos(reto.evidencia)
  const etiqueta = ritmoTieneP(tira.ritmo) ? 'P' : 'sin P'
  return (
    marcas.length === reto.evidencia.length &&
    marcas.length === conP.length &&
    marcas.every((t, i) => {
      const latido = conP[i]
      return (
        latido !== undefined &&
        t.etiqueta === etiqueta &&
        cerca(t.desdeMs, Math.max(0, latido.pInicioMs)) &&
        cerca(t.hastaMs, latido.pFinMs) &&
        t.hastaMs <= latido.qrsInicioMs
      )
    })
  )
}

/** La evidencia de un reto con tira, según lo que pregunta; los retos sin tira no tienen. */
function evidenciaCoherente(reto: Reto): boolean {
  if (reto.vista.tipo !== 'tira') return reto.evidencia.length === 0
  const tira = reto.vista.tira
  const r = reto.respuesta
  // Un tipo con tira que no está acá no tiene regla de evidencia: falla, para que se la agregue.
  const reglas: Partial<Record<TipoReto, () => boolean>> = {
    'frecuencia-contar-grandes': () => r.modo === 'conteo' && cuadradosCoherentes(reto, r.correcta),
    'frecuencia-regla-300': () =>
      r.modo === 'opciones' && cuadradosCoherentes(reto, 300 / Number(r.correcta)),
    'frecuencia-contar-qrs': () => qrsCoherentes(reto, tira),
    'ritmo-regular': () => rrCoherentes(reto, tira),
    'ritmo-p': () => pCoherentes(reto, tira),
  }
  return reglas[reto.tipo]?.() ?? false
}

/** Mientras se pregunta, el reto muestra sólo sus marcas de siempre: nada de la evidencia. */
const sinEvidenciaAntes = (reto: Reto) =>
  reto.marcas.every((m) => m.tipo !== 'tramo' && m.tipo !== 'rotulo')

describe('evidencia al responder', () => {
  it('todo reto de todo nivel: la evidencia cuenta lo mismo que la respuesta', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nivelesConTipos), semillas, ({ nivel, tipo }, semilla) => {
        const reto = generarReto(nivel, tipo, crearAzar(semilla), 1)
        return evidenciaCoherente(reto) && sinEvidenciaAntes(reto)
      }),
    )
  })

  it('los retos con tira siempre traen evidencia', () => {
    fc.assert(
      fc.property(fc.constantFrom(...nivelesConTipos), semillas, ({ nivel, tipo }, semilla) => {
        const reto = generarReto(nivel, tipo, crearAzar(semilla), 1)
        return reto.vista.tipo !== 'tira' || reto.evidencia.length > 0
      }),
    )
  })

  it('cuadrados grandes y regla del 300: tantos cuadrados numerados como la respuesta', () => {
    fc.assert(
      fc.property(
        semillas,
        fc.constantFrom<TipoReto>('frecuencia-contar-grandes', 'frecuencia-regla-300'),
        (semilla, tipo) => {
          const reto = generarReto('frecuencia', tipo, crearAzar(semilla), 1)
          const r = reto.respuesta
          const cuadrados = r.modo === 'conteo' ? r.correcta : 300 / Number(r.correcta)
          return tramos(reto.evidencia).length === cuadrados
        },
      ),
    )
  })

  it('contar QRS: el último número es el conteo correcto', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const reto = generarReto('frecuencia', 'frecuencia-contar-qrs', crearAzar(semilla), 1)
        if (reto.respuesta.modo !== 'conteo') return false
        return reto.evidencia.at(-1)?.etiqueta === numero(reto.respuesta.correcta)
      }),
    )
  })

  it('la P: una marca por latido visible, «P» o «sin P» según el ritmo', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const reto = generarReto('ritmo', 'ritmo-p', crearAzar(semilla), 1)
        if (reto.vista.tipo !== 'tira') return false
        const visibles = latidosVisibles(reto.vista.tira).filter((l) => l.pFinMs > 0)
        const esperada = reto.respuesta.correcta === 'si' ? 'P' : 'sin P'
        return (
          reto.evidencia.length === visibles.length &&
          reto.evidencia.every((m) => m.etiqueta === esperada)
        )
      }),
    )
  })

  it('la lectura completa usa los mismos generadores: sus retos con tira traen la evidencia', () => {
    fc.assert(
      fc.property(semillas, (semilla) => {
        const retos = generarLectura(crearAzar(semilla), 1)
        return retos.every((r) => evidenciaCoherente(r) && sinEvidenciaAntes(r))
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

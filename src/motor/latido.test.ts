import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { crearAzar } from './azar.ts'
import {
  LATIDO_NORMAL,
  ajustarAlRitmo,
  contarQrs,
  generarTira,
  latidosVisibles,
  regionesLatido,
  voltajeLatido,
  type ParametrosLatido,
} from './latido.ts'
import { rrPorFrecuencia } from './papel.ts'

/** Parámetros fisiológicamente posibles, con sus restricciones: PR ≥ P y QT ≥ QRS + T. */
const parametros: fc.Arbitrary<ParametrosLatido> = fc
  .record({
    pMs: fc.integer({ min: 60, max: 120 }),
    prExtraMs: fc.integer({ min: 0, max: 200 }),
    qrsMs: fc.integer({ min: 60, max: 200 }),
    tMs: fc.integer({ min: 120, max: 220 }),
    stMs: fc.integer({ min: 40, max: 160 }),
    pMv: fc.double({ min: 0.05, max: 0.25, noNaN: true }),
    rMv: fc.double({ min: 0.8, max: 2, noNaN: true }),
    stMv: fc.double({ min: -0.2, max: 0.3, noNaN: true }),
    pPresente: fc.boolean(),
  })
  .chain((r) => {
    // La frecuencia más alta que deja entrar PR + QRS + una T mínima en el RR.
    const prMs = r.pMs + r.prExtraMs
    const maxima = Math.min(180, Math.floor(60000 / (prMs + r.qrsMs + 160)))
    return fc.integer({ min: 30, max: Math.max(30, maxima) }).map((frecuencia) => ({
      frecuencia,
      prMs,
      pMs: r.pMs,
      qrsMs: r.qrsMs,
      qtMs: r.qrsMs + r.stMs + r.tMs,
      tMs: r.tMs,
      pMv: r.pMv,
      qMv: -0.1,
      rMv: r.rMv,
      sMv: -0.25,
      tMv: 0.3,
      stMv: r.stMv,
      pPresente: r.pPresente,
    }))
  })

const semillas = fc.integer({ min: 0, max: 2 ** 31 - 1 })

describe('voltajeLatido', () => {
  it('vale cero antes de la P y después de la T', () => {
    fc.assert(
      fc.property(parametros, (p) => {
        const fin = p.prMs + p.qtMs
        return voltajeLatido(-1, p) === 0 && voltajeLatido(fin + 1, p) === 0
      }),
    )
  })

  it('el pico de la R es la amplitud pedida y cae dentro del QRS', () => {
    fc.assert(
      fc.property(parametros, (p) => {
        let maximo = -Infinity
        let enMs = -1
        for (let t = 0; t <= p.prMs + p.qtMs; t += 1) {
          const mv = voltajeLatido(t, p)
          if (mv > maximo) {
            maximo = mv
            enMs = t
          }
        }
        // Se muestrea de a 1 ms: el pico real puede caer entre dos muestras.
        return Math.abs(maximo - p.rMv) < 0.06 && enMs >= p.prMs && enMs <= p.prMs + p.qrsMs
      }),
    )
  })

  it('sin onda P, el tramo de la P queda plano', () => {
    fc.assert(
      fc.property(parametros, (p) => {
        const sinP = { ...p, pPresente: false }
        for (let t = 0; t < p.pMs; t += 1) if (voltajeLatido(t, sinP) !== 0) return false
        return true
      }),
    )
  })
})

describe('ajustarAlRitmo', () => {
  it('el latido entra en su RR y conserva PR, QRS y el orden de sus partes', () => {
    fc.assert(
      fc.property(parametros, (p) => {
        const rr = rrPorFrecuencia(p.frecuencia)
        const a = ajustarAlRitmo(p, rr)
        return (
          a.prMs === p.prMs &&
          a.qrsMs === p.qrsMs &&
          a.qtMs <= p.qtMs &&
          a.qtMs >= a.qrsMs + a.tMs &&
          a.tMs > 0 &&
          (a.prMs + a.qtMs < rr || a.qtMs === a.qrsMs + 40)
        )
      }),
    )
  })

  it('a frecuencias bajas no toca nada', () => {
    expect(ajustarAlRitmo({ ...LATIDO_NORMAL, frecuencia: 50 }, rrPorFrecuencia(50))).toEqual({
      ...LATIDO_NORMAL,
      frecuencia: 50,
    })
  })
})

describe('generarTira', () => {
  it('en ritmo regular la distancia entre R consecutivas es exactamente el RR de la frecuencia', () => {
    fc.assert(
      fc.property(parametros, semillas, (p, semilla) => {
        const tira = generarTira({
          duracionMs: 6000,
          parametros: p,
          ritmo: 'regular',
          azar: crearAzar(semilla),
        })
        const rr = rrPorFrecuencia(p.frecuencia)
        const visibles = latidosVisibles(tira)
        for (let i = 1; i < visibles.length; i += 1) {
          const a = visibles[i - 1]
          const b = visibles[i]
          if (!a || !b || Math.abs(b.rMs - a.rMs - rr) > 1e-6) return false
        }
        return visibles.length >= Math.floor(6000 / rr) - 1
      }),
    )
  })

  it('los picos que de verdad se dibujan son exactamente las R que contarQrs cuenta', () => {
    fc.assert(
      fc.property(
        parametros,
        semillas,
        fc.constantFrom('regular', 'sinusal-irregular', 'irregular-sin-p' as const),
        (p, semilla, ritmo) => {
          const tira = generarTira({
            duracionMs: 6000,
            parametros: p,
            ritmo,
            azar: crearAzar(semilla),
          })
          // Por encima de este umbral sólo pasa la R: la T llega como mucho a stMv + tMv, más la
          // ondulación de base de un ritmo sin P (0,06 mV). Un latido que no entra en su RR se
          // recorta (ajustarAlRitmo), así que la T no se suma a la P siguiente.
          const umbral = Math.max(p.stMv, 0) + 0.3 + 0.1
          // Cada R contada tiene su pico dibujado.
          for (const latido of tira.latidos) {
            if (
              latido.rMs <= 6000 &&
              tira.muestras[Math.round(latido.rMs / tira.pasoMs)]! < umbral
            ) {
              return false
            }
          }
          // Cada subida por encima del umbral está justo antes de alguna R, dentro de la tira o apenas después.
          let arriba = false
          for (let i = 0; i < tira.muestras.length; i += 1) {
            const mv = tira.muestras[i]!
            if (mv > umbral && !arriba) {
              arriba = true
              const tMs = i * tira.pasoMs
              // El cruce cae en la subida de la R o, por el muestreo, en la muestra siguiente al pico.
              const rCerca = tira.latidos.some(
                (l) => tMs <= l.rMs + 2 * tira.pasoMs && l.rMs - tMs <= p.qrsMs,
              )
              if (!rCerca) return false
            } else if (mv <= umbral) {
              arriba = false
            }
          }
          return contarQrs(tira, 0, 6000) === tira.latidos.filter((l) => l.rMs <= 6000).length
        },
      ),
    )
  })

  it('en un ritmo sin P el trazo no es plano entre latidos', () => {
    const tira = generarTira({
      duracionMs: 3000,
      parametros: LATIDO_NORMAL,
      ritmo: 'irregular-sin-p',
      azar: crearAzar(7),
    })
    expect(tira.latidos.every((l) => !l.parametros.pPresente)).toBe(true)
    expect(tira.muestras.some((mv) => mv !== 0 && Math.abs(mv) < 0.08)).toBe(true)
  })
})

describe('regionesLatido', () => {
  it('las regiones son contiguas y cubren de la P a la T', () => {
    fc.assert(
      fc.property(parametros, (p) => {
        const tira = generarTira({
          duracionMs: 2000,
          parametros: p,
          ritmo: 'regular',
          azar: crearAzar(1),
          inicioMs: 100,
        })
        const latido = tira.latidos[0]
        if (!latido) return false
        const ajustado = ajustarAlRitmo(p, rrPorFrecuencia(p.frecuencia))
        const r = regionesLatido(latido)
        return (
          r.p.hastaMs === r['pr-segmento'].desdeMs &&
          r['pr-segmento'].hastaMs === r.qrs.desdeMs &&
          r.qrs.hastaMs === r.st.desdeMs &&
          r.st.hastaMs === r.t.desdeMs &&
          r['pr-intervalo'].desdeMs === r.p.desdeMs &&
          r['pr-intervalo'].hastaMs === r.qrs.desdeMs &&
          Math.abs(r['pr-intervalo'].hastaMs - r['pr-intervalo'].desdeMs - p.prMs) < 1e-9 &&
          Math.abs(r.qt.hastaMs - r.qt.desdeMs - ajustado.qtMs) < 1e-9
        )
      }),
    )
  })
})

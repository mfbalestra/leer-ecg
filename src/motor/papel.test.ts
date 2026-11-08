import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  CUADRADO_CHICO_MM,
  CUADRADO_GRANDE_MM,
  MS_POR_CUADRADO_CHICO,
  MS_POR_CUADRADO_GRANDE,
  MV_POR_CUADRADO_CHICO,
  SECUENCIA_300,
  cuadradosChicos,
  frecuenciaPorConteo,
  frecuenciaPorCuadradosGrandes,
  msAMm,
  mvAMm,
  rrPorFrecuencia,
} from './papel.ts'

const frecuencias = fc.double({ min: 20, max: 300, noNaN: true })

describe('el papel a 25 mm/s y 10 mm/mV', () => {
  it('un cuadrado chico son 40 ms y 0,1 mV; uno grande, 200 ms', () => {
    expect(msAMm(MS_POR_CUADRADO_CHICO)).toBe(CUADRADO_CHICO_MM)
    expect(msAMm(MS_POR_CUADRADO_GRANDE)).toBe(CUADRADO_GRANDE_MM)
    expect(mvAMm(MV_POR_CUADRADO_CHICO)).toBe(CUADRADO_CHICO_MM)
    expect(cuadradosChicos(200)).toBe(5)
  })

  it('milisegundos y milímetros son proporcionales', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 10000, noNaN: true }), (ms) => {
        return Math.abs(msAMm(ms) - ms / MS_POR_CUADRADO_CHICO) < 1e-9
      }),
    )
  })

  it('la regla del 300 da la secuencia 300, 150, 100, 75, 60, 50', () => {
    expect([1, 2, 3, 4, 5, 6].map(frecuenciaPorCuadradosGrandes)).toEqual([...SECUENCIA_300])
  })

  it('la regla del 300 coincide con la distancia entre dos R', () => {
    fc.assert(
      fc.property(frecuencias, (lpm) => {
        const rr = rrPorFrecuencia(lpm)
        return Math.abs(frecuenciaPorCuadradosGrandes(rr / MS_POR_CUADRADO_GRANDE) - lpm) < 1e-9
      }),
    )
  })

  it('el conteo en 6 segundos multiplica por 10', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30 }), (qrs) => {
        return frecuenciaPorConteo(qrs, 6) === qrs * 10
      }),
    )
  })
})

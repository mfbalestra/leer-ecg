import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { nivelPorId, type NivelId, type Reto } from './retos.ts'
import { avance, avanzar, crearSesion, responder, terminada, type Sesion } from './sesion.ts'

const semillas = fc.integer({ min: 0, max: 2 ** 31 - 1 })
const niveles: NivelId[] = ['papel', 'latido', 'frecuencia', 'ritmo', 'lectura']

function respuestaCorrecta(reto: Reto): string | number {
  return reto.respuesta.correcta
}

function respuestaIncorrecta(reto: Reto): string | number {
  const r = reto.respuesta
  if (r.modo === 'conteo') return r.correcta + 1
  const otra = (r.modo === 'opciones' ? r.opciones : r.zonas).find((o) => o.id !== r.correcta)
  return otra ? otra.id : '__ninguna__'
}

/** Juega la sesión entera acertando siempre y devuelve el final y los tipos en el orden jugado. */
function jugarAcertando(sesion: Sesion): { final: Sesion; tipos: string[] } {
  let s = sesion
  const tipos: string[] = []
  while (!terminada(s)) {
    tipos.push(s.actual.tipo)
    s = responder(s, respuestaCorrecta(s.actual)).sesion
    if (!terminada(s)) s = avanzar(s)
    if (tipos.length > 100) throw new Error('La sesión no termina')
  }
  return { final: s, tipos }
}

const sinRepetirSeguido = (tipos: string[]) => tipos.every((t, i) => i === 0 || t !== tipos[i - 1])

describe('sesion', () => {
  it('acertando siempre, termina en exactamente la meta de aciertos sin repetir el mismo tipo seguido', () => {
    fc.assert(
      fc.property(fc.constantFrom(...niveles), semillas, (nivel, semilla) => {
        const { final, tipos } = jugarAcertando(crearSesion(nivel, semilla))
        const meta = nivelPorId(nivel).meta
        if (nivel === 'lectura') return final.aciertos >= meta && final.errores === 0
        return (
          final.aciertos === meta &&
          final.errores === 0 &&
          final.racha === meta &&
          sinRepetirSeguido(tipos)
        )
      }),
    )
  })

  it('un error no suma, corta la racha y el mismo tipo vuelve dos retos después', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<NivelId>('papel', 'latido', 'frecuencia', 'ritmo'),
        semillas,
        (nivel, semilla) => {
          const inicial = crearSesion(nivel, semilla)
          const tipoErrado = inicial.actual.tipo
          const errada = responder(inicial, respuestaIncorrecta(inicial.actual))
          if (errada.correcto || errada.sesion.aciertos !== 0 || errada.sesion.racha !== 0)
            return false
          // Dos retos de otro tipo, y al tercero vuelve el errado.
          let s = avanzar(errada.sesion)
          const intermedios: string[] = []
          for (let i = 0; i < 2; i += 1) {
            intermedios.push(s.actual.tipo)
            s = avanzar(responder(s, respuestaCorrecta(s.actual)).sesion)
          }
          return s.actual.tipo === tipoErrado && s.actual.id !== inicial.actual.id
        },
      ),
    )
  })

  it('la misma semilla da la misma secuencia de retos', () => {
    fc.assert(
      fc.property(fc.constantFrom(...niveles), semillas, (nivel, semilla) => {
        const a = crearSesion(nivel, semilla)
        const b = crearSesion(nivel, semilla)
        return a.actual.id === b.actual.id && a.actual.enunciado === b.actual.enunciado
      }),
    )
  })

  it('la lectura completa termina al cerrar la tira en curso, nunca a mitad de una', () => {
    const { final } = jugarAcertando(crearSesion('lectura', 11))
    expect(final.cola).toHaveLength(0)
    expect(final.aciertos).toBeGreaterThanOrEqual(nivelPorId('lectura').meta)
    expect(avance(final).hechos).toBe(final.aciertos)
  })

  it('la lectura no termina mientras el último reto de la tira siga sin responder', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (semilla) => {
        let s = crearSesion('lectura', semilla)
        let vueltas = 0
        while (!terminada(s)) {
          s = responder(s, respuestaCorrecta(s.actual)).sesion
          if (!terminada(s)) s = avanzar(s)
          vueltas += 1
          if (vueltas > 100) throw new Error('La sesión no termina')
        }
        expect(s.aciertos + s.errores).toBe(s.presentados)
      }),
      { numRuns: 60 },
    )
  })
})

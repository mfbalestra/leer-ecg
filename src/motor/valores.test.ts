import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { NORMAL, juzgarFrecuencia, juzgarPr, juzgarQrs } from './valores.ts'

// Los umbrales son los de las fuentes citadas en `valores.ts`: el test fija los bordes, no el código.

describe('los juicios siguen los valores normales citados', () => {
  it('frecuencia: 60 y 100 son normales; 59 es bradicardia y 101 taquicardia', () => {
    expect(juzgarFrecuencia(59)).toBe('bradicardia')
    expect(juzgarFrecuencia(60)).toBe('normal')
    expect(juzgarFrecuencia(100)).toBe('normal')
    expect(juzgarFrecuencia(101)).toBe('taquicardia')
  })

  it('PR: 120 y 200 ms son normales; 119 es corto y 201 largo', () => {
    expect(juzgarPr(119)).toBe('corto')
    expect(juzgarPr(120)).toBe('normal')
    expect(juzgarPr(200)).toBe('normal')
    expect(juzgarPr(201)).toBe('largo')
  })

  it('QRS: hasta 100 ms es angosto; 101 ya es ancho', () => {
    expect(juzgarQrs(100)).toBe('angosto')
    expect(juzgarQrs(101)).toBe('ancho')
    expect(NORMAL.qrs.bloqueoMs).toBeGreaterThan(NORMAL.qrs.maxMs)
  })

  it('cada juicio es monótono: subir el valor nunca lo lleva a una categoría más baja', () => {
    const orden = {
      bradicardia: 0,
      corto: 0,
      angosto: 0,
      normal: 1,
      taquicardia: 2,
      largo: 2,
      ancho: 2,
    }
    const valores = fc.double({ min: 0, max: 400, noNaN: true })
    fc.assert(
      fc.property(valores, valores, (a, b) => {
        const [menor, mayor] = a <= b ? [a, b] : [b, a]
        return (
          orden[juzgarFrecuencia(menor)] <= orden[juzgarFrecuencia(mayor)] &&
          orden[juzgarPr(menor)] <= orden[juzgarPr(mayor)] &&
          orden[juzgarQrs(menor)] <= orden[juzgarQrs(mayor)]
        )
      }),
    )
  })
})

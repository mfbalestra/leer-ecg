import { describe, expect, it } from 'vitest'

import {
  CLAVE_PROGRESO,
  cargarProgreso,
  guardarProgreso,
  progresoVacio,
  registrarExamen,
  registrarNivel,
  siguienteNivel,
  type Almacen,
} from './progreso.ts'

function almacenEnMemoria(
  inicial: Record<string, string> = {},
): Almacen & { datos: Record<string, string> } {
  const datos = { ...inicial }
  return {
    datos,
    getItem: (clave) => datos[clave] ?? null,
    setItem: (clave, valor) => {
      datos[clave] = valor
    },
  }
}

describe('progreso', () => {
  it('guarda y vuelve a cargar lo mismo', () => {
    const almacen = almacenEnMemoria()
    const progreso = registrarNivel(progresoVacio(), 'papel', 5)
    expect(guardarProgreso(almacen, progreso)).toBe(true)
    expect(cargarProgreso(almacen)).toEqual(progreso)
  })

  it('con datos corruptos o sin almacenamiento arranca de cero', () => {
    expect(cargarProgreso(almacenEnMemoria({ [CLAVE_PROGRESO]: '{no es json' }))).toEqual(
      progresoVacio(),
    )
    expect(cargarProgreso(almacenEnMemoria({ [CLAVE_PROGRESO]: '{"version":9}' }))).toEqual(
      progresoVacio(),
    )
    expect(cargarProgreso(null)).toEqual(progresoVacio())
  })

  it('un nivel guardado con otra forma vuelve a cero sin perder los demás', () => {
    const guardado = registrarNivel(registrarNivel(progresoVacio(), 'papel', 3), 'latido', 2)
    const roto = JSON.parse(JSON.stringify(guardado)) as { niveles: Record<string, unknown> }
    roto.niveles['papel'] = null
    roto.niveles['frecuencia'] = { completado: 'sí' }
    const cargado = cargarProgreso(almacenEnMemoria({ [CLAVE_PROGRESO]: JSON.stringify(roto) }))
    expect(cargado.niveles.papel).toEqual(progresoVacio().niveles.papel)
    expect(cargado.niveles.frecuencia).toEqual(progresoVacio().niveles.frecuencia)
    expect(cargado.niveles.latido).toEqual(guardado.niveles.latido)
  })

  it('si el almacenamiento falla al escribir, avisa sin romper', () => {
    const roto: Almacen = {
      getItem: () => null,
      setItem: () => {
        throw new Error('cuota llena')
      },
    }
    expect(guardarProgreso(roto, progresoVacio())).toBe(false)
  })

  it('el examen guarda el mejor resultado: más aciertos, o iguales en menos tiempo', () => {
    let p = registrarExamen(progresoVacio(), { aciertos: 8, total: 12, segundos: 90 })
    p = registrarExamen(p, { aciertos: 7, total: 12, segundos: 30 })
    expect(p.examen).toEqual({ mejorAciertos: 8, total: 12, mejorSegundos: 90 })
    p = registrarExamen(p, { aciertos: 8, total: 12, segundos: 60 })
    expect(p.examen.mejorSegundos).toBe(60)
    p = registrarExamen(p, { aciertos: 12, total: 12, segundos: 200 })
    expect(p.examen).toEqual({ mejorAciertos: 12, total: 12, mejorSegundos: 200 })
  })

  it('el siguiente nivel es el primero sin completar', () => {
    const orden = ['papel', 'latido', 'frecuencia'] as const
    let p = progresoVacio()
    expect(siguienteNivel(p, orden)).toBe('papel')
    p = registrarNivel(p, 'papel', 1)
    expect(siguienteNivel(p, orden)).toBe('latido')
    p = registrarNivel(p, 'latido', 1)
    p = registrarNivel(p, 'frecuencia', 1)
    expect(siguienteNivel(p, orden)).toBeNull()
  })
})

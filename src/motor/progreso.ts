// El progreso vive en el navegador: qué niveles se completaron, la mejor racha y el mejor examen.
// Si el almacenamiento falla (modo privado, cuota), la app sigue sin guardar.

import type { NivelId } from './retos.ts'

export const CLAVE_PROGRESO = 'leer-ecg.progreso.v1'

export type ProgresoNivel = { completado: boolean; mejorRacha: number; veces: number }

export type Progreso = {
  version: 1
  niveles: Record<NivelId, ProgresoNivel>
  examen: { mejorAciertos: number; total: number; mejorSegundos: number | null }
}

const NIVEL_VACIO: ProgresoNivel = { completado: false, mejorRacha: 0, veces: 0 }

export function progresoVacio(): Progreso {
  return {
    version: 1,
    niveles: {
      papel: { ...NIVEL_VACIO },
      latido: { ...NIVEL_VACIO },
      frecuencia: { ...NIVEL_VACIO },
      ritmo: { ...NIVEL_VACIO },
      lectura: { ...NIVEL_VACIO },
    },
    examen: { mejorAciertos: 0, total: 0, mejorSegundos: null },
  }
}

export type Almacen = Pick<Storage, 'getItem' | 'setItem'>

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function esNivel(valor: unknown): valor is ProgresoNivel {
  return (
    esObjeto(valor) &&
    typeof valor['completado'] === 'boolean' &&
    typeof valor['mejorRacha'] === 'number' &&
    typeof valor['veces'] === 'number'
  )
}

function esExamen(valor: unknown): valor is Progreso['examen'] {
  return (
    esObjeto(valor) &&
    typeof valor['mejorAciertos'] === 'number' &&
    typeof valor['total'] === 'number' &&
    (valor['mejorSegundos'] === null || typeof valor['mejorSegundos'] === 'number')
  )
}

/** Lo guardado se toma pieza por pieza: un nivel o un examen con otra forma vuelve a cero solo. */
function desdeGuardado(valor: unknown): Progreso {
  const vacio = progresoVacio()
  if (!esObjeto(valor) || valor['version'] !== 1) return vacio
  const niveles = esObjeto(valor['niveles']) ? valor['niveles'] : {}
  for (const id of Object.keys(vacio.niveles) as NivelId[]) {
    const nivel = niveles[id]
    if (esNivel(nivel)) vacio.niveles[id] = { ...nivel }
  }
  if (esExamen(valor['examen'])) vacio.examen = { ...valor['examen'] }
  return vacio
}

export function cargarProgreso(almacen: Almacen | null): Progreso {
  if (!almacen) return progresoVacio()
  try {
    const crudo = almacen.getItem(CLAVE_PROGRESO)
    if (!crudo) return progresoVacio()
    return desdeGuardado(JSON.parse(crudo))
  } catch {
    return progresoVacio()
  }
}

export function guardarProgreso(almacen: Almacen | null, progreso: Progreso): boolean {
  if (!almacen) return false
  try {
    almacen.setItem(CLAVE_PROGRESO, JSON.stringify(progreso))
    return true
  } catch {
    return false
  }
}

/** Un nivel se registra al cerrarlo, así que queda completado; guarda la mejor racha y las veces. */
export function registrarNivel(progreso: Progreso, nivel: NivelId, mejorRacha: number): Progreso {
  const anterior = progreso.niveles[nivel]
  return {
    ...progreso,
    niveles: {
      ...progreso.niveles,
      [nivel]: {
        completado: true,
        mejorRacha: Math.max(anterior.mejorRacha, mejorRacha),
        veces: anterior.veces + 1,
      },
    },
  }
}

export function registrarExamen(
  progreso: Progreso,
  resultado: { aciertos: number; total: number; segundos: number },
): Progreso {
  const anterior = progreso.examen
  const mejora =
    resultado.aciertos > anterior.mejorAciertos ||
    (resultado.aciertos === anterior.mejorAciertos &&
      (anterior.mejorSegundos === null || resultado.segundos < anterior.mejorSegundos))
  return {
    ...progreso,
    examen: mejora
      ? {
          mejorAciertos: resultado.aciertos,
          total: resultado.total,
          mejorSegundos: resultado.segundos,
        }
      : anterior,
  }
}

/** Niveles completados en orden; el siguiente a jugar es el primero no completado. */
export function siguienteNivel(progreso: Progreso, orden: readonly NivelId[]): NivelId | null {
  return orden.find((id) => !progreso.niveles[id].completado) ?? null
}

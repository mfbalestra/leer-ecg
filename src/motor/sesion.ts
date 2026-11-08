// Una sesión de nivel: la cola de retos, los aciertos y la repetición de lo que se erró.
// Un reto errado vuelve, con otros números, dos retos más adelante; uno acertado no se repite.

import { crearAzar, semillaDesde, type Azar } from './azar.ts'
import {
  TIPOS_POR_NIVEL,
  esCorrecta,
  generarLectura,
  generarReto,
  nivelPorId,
  type NivelId,
  type RespuestaDada,
  type Reto,
  type TipoReto,
} from './retos.ts'

/** Retos de otro tipo que pasan entre un error y su repetición. */
const DISTANCIA_REPASO = 2

export type Sesion = {
  nivel: NivelId
  meta: number
  aciertos: number
  errores: number
  racha: number
  mejorRacha: number
  /** Retos ya generados que esperan su turno. */
  cola: Reto[]
  actual: Reto
  /** Tipos errados y en qué número de reto deben volver. */
  repasos: { tipo: TipoReto; en: number }[]
  /** Cuántos retos se presentaron. */
  presentados: number
  ultimoTipo: TipoReto | null
  semilla: number
}

function azarDe(sesion: Pick<Sesion, 'semilla' | 'presentados'>): Azar {
  return crearAzar(semillaDesde(sesion.semilla, sesion.presentados))
}

/** Un tipo al azar, sin repetir el último ni adelantar uno que ya está programado para repaso. */
function elegirTipo(
  nivel: NivelId,
  ultimo: TipoReto | null,
  programados: readonly TipoReto[],
  azar: Azar,
): TipoReto {
  const tipos = TIPOS_POR_NIVEL[nivel]
  const libres = tipos.filter((t) => t !== ultimo && !programados.includes(t))
  const candidatos = libres.length > 0 ? libres : tipos.filter((t) => t !== ultimo)
  return azar.elegir(candidatos.length > 0 ? candidatos : tipos)
}

function generarSiguiente(sesion: Omit<Sesion, 'actual'>): { reto: Reto; cola: Reto[] } {
  const [primero, ...resto] = sesion.cola
  if (primero) return { reto: primero, cola: resto }
  const azar = azarDe(sesion)
  if (sesion.nivel === 'lectura') {
    const [reto, ...cola] = generarLectura(azar, sesion.presentados)
    if (!reto) throw new Error('La lectura no generó retos')
    return { reto, cola }
  }
  const repaso = sesion.repasos.find((r) => r.en <= sesion.presentados)
  const tipo = repaso
    ? repaso.tipo
    : elegirTipo(
        sesion.nivel,
        sesion.ultimoTipo,
        sesion.repasos.map((r) => r.tipo),
        azar,
      )
  return { reto: generarReto(sesion.nivel, tipo, azar, sesion.presentados), cola: [] }
}

export function crearSesion(nivel: NivelId, semilla: number): Sesion {
  const base: Omit<Sesion, 'actual'> = {
    nivel,
    meta: nivelPorId(nivel).meta,
    aciertos: 0,
    errores: 0,
    racha: 0,
    mejorRacha: 0,
    cola: [],
    repasos: [],
    presentados: 0,
    ultimoTipo: null,
    semilla,
  }
  const { reto, cola } = generarSiguiente(base)
  return { ...base, cola, actual: reto, presentados: 1, ultimoTipo: reto.tipo }
}

export type Resultado = { sesion: Sesion; correcto: boolean }

/** Registra la respuesta al reto actual sin avanzar: la pantalla muestra el resultado y después avanza. */
export function responder(sesion: Sesion, dada: RespuestaDada): Resultado {
  const correcto = esCorrecta(sesion.actual, dada)
  if (correcto) {
    const racha = sesion.racha + 1
    return {
      correcto,
      sesion: {
        ...sesion,
        aciertos: sesion.aciertos + 1,
        racha,
        mejorRacha: Math.max(sesion.mejorRacha, racha),
        repasos: sesion.repasos.filter(
          (r) => r.tipo !== sesion.actual.tipo || r.en > sesion.presentados,
        ),
      },
    }
  }
  const yaProgramado = sesion.repasos.some((r) => r.tipo === sesion.actual.tipo)
  const repasos =
    yaProgramado || sesion.nivel === 'lectura'
      ? sesion.repasos
      : [...sesion.repasos, { tipo: sesion.actual.tipo, en: sesion.presentados + DISTANCIA_REPASO }]
  return {
    correcto,
    sesion: { ...sesion, errores: sesion.errores + 1, racha: 0, repasos },
  }
}

/** Pasa al reto siguiente. */
export function avanzar(sesion: Sesion): Sesion {
  const { reto, cola } = generarSiguiente(sesion)
  const repasos = sesion.repasos.filter(
    (r) => !(r.tipo === reto.tipo && r.en <= sesion.presentados),
  )
  return {
    ...sesion,
    cola,
    actual: reto,
    repasos,
    presentados: sesion.presentados + 1,
    ultimoTipo: reto.tipo,
  }
}

/** El nivel termina cuando se alcanza la meta de aciertos; la lectura, cuando se contestó la cola entera. */
export function terminada(sesion: Sesion): boolean {
  if (sesion.nivel === 'lectura') {
    const respondidos = sesion.aciertos + sesion.errores
    // El reto en pantalla cuenta como pendiente hasta que se responde: con la cola vacía y la meta
    // alcanzada, la lectura sigue abierta mientras falte contestar el actual.
    return (
      respondidos >= sesion.meta && sesion.cola.length === 0 && respondidos === sesion.presentados
    )
  }
  return sesion.aciertos >= sesion.meta
}

/** Cuántos retos faltan responder, para la barra de avance. */
export function avance(sesion: Sesion): { hechos: number; meta: number } {
  if (sesion.nivel === 'lectura')
    return { hechos: sesion.aciertos + sesion.errores, meta: sesion.meta }
  return { hechos: sesion.aciertos, meta: sesion.meta }
}

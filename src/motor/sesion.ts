// Una sesión de nivel: la cola de retos, los aciertos y la repetición de lo que se erró.
// Un reto errado vuelve, con otros números, dos retos más adelante; uno acertado no se repite.
// Los tipos del nivel salen todos antes de repetir uno, y una pregunta idéntica a otra ya mostrada
// sólo vuelve cuando el tipo no tiene otra versión que ofrecer.

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

/** Versiones de un tipo que se prueban para encontrar una pregunta todavía no mostrada. */
const INTENTOS_VARIANTE = 24

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
  /** Tipos acertados en la vuelta actual; cuando están todos, empieza otra vuelta. */
  acertadosVuelta: TipoReto[]
  /** Huellas de las preguntas mostradas y de las acertadas. */
  mostradas: string[]
  acertadas: string[]
}

function azarDe(sesion: Pick<Sesion, 'semilla' | 'presentados'>): Azar {
  return crearAzar(semillaDesde(sesion.semilla, sesion.presentados))
}

/** FNV-1a de 32 bits: acorta la huella sin guardar la tira entera. */
function resumir(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/**
 * Lo que la persona ve de un reto: enunciado, dibujo y respuesta. El orden de las opciones y los
 * identificadores internos no cuentan; dos retos con la misma huella son la misma pregunta.
 */
function huella(reto: Reto): string {
  const vista = reto.vista
  let dibujo: unknown = vista
  if (vista.tipo === 'latido') dibujo = { ...vista, tira: vista.tira.muestras }
  if (vista.tipo === 'tira') dibujo = vista.tira.muestras
  return resumir(
    JSON.stringify([reto.tipo, reto.enunciado, reto.respuesta.correcta, reto.marcas, dibujo]),
  )
}

/**
 * Un tipo al azar, sin repetir el último ni adelantar uno programado para repaso, y entre ellos uno
 * que todavía no se acertó en esta vuelta. Cada condición se afloja sólo si deja sin candidatos.
 */
function elegirTipo(
  nivel: NivelId,
  ultimo: TipoReto | null,
  programados: readonly TipoReto[],
  acertadosVuelta: readonly TipoReto[],
  azar: Azar,
): TipoReto {
  const tipos = TIPOS_POR_NIVEL[nivel]
  const filtros: ((t: TipoReto) => boolean)[] = [
    (t) => t !== ultimo && !programados.includes(t) && !acertadosVuelta.includes(t),
    (t) => t !== ultimo && !programados.includes(t),
    (t) => t !== ultimo,
  ]
  for (const filtro of filtros) {
    const candidatos = tipos.filter(filtro)
    if (candidatos.length > 0) return azar.elegir(candidatos)
  }
  return azar.elegir(tipos)
}

/**
 * Una versión del tipo que no se haya mostrado; si el tipo no tiene otra, una que no se haya
 * acertado; y sólo si tampoco hay, la última generada.
 */
function generarVariante(sesion: Omit<Sesion, 'actual'>, tipo: TipoReto, azar: Azar): Reto {
  let noAcertada: Reto | null = null
  let ultima: Reto | null = null
  for (let i = 0; i < INTENTOS_VARIANTE; i += 1) {
    const reto = generarReto(sesion.nivel, tipo, azar, sesion.presentados)
    const h = huella(reto)
    if (!sesion.mostradas.includes(h)) return reto
    if (!noAcertada && !sesion.acertadas.includes(h)) noAcertada = reto
    ultima = reto
  }
  const elegida = noAcertada ?? ultima
  if (!elegida) throw new Error('No se generó ningún reto')
  return elegida
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
        sesion.acertadosVuelta,
        azar,
      )
  return { reto: generarVariante(sesion, tipo, azar), cola: [] }
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
    acertadosVuelta: [],
    mostradas: [],
    acertadas: [],
  }
  const { reto, cola } = generarSiguiente(base)
  return {
    ...base,
    cola,
    actual: reto,
    presentados: 1,
    ultimoTipo: reto.tipo,
    mostradas: [huella(reto)],
  }
}

/** Suma el tipo acertado a la vuelta; con todos los tipos del nivel acertados, la vuelta se reinicia. */
function sumarAVuelta(sesion: Sesion): TipoReto[] {
  const tipo = sesion.actual.tipo
  const vuelta = sesion.acertadosVuelta.includes(tipo)
    ? sesion.acertadosVuelta
    : [...sesion.acertadosVuelta, tipo]
  const completa = TIPOS_POR_NIVEL[sesion.nivel].every((t) => vuelta.includes(t))
  return completa ? [] : vuelta
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
        acertadosVuelta: sumarAVuelta(sesion),
        acertadas: [...sesion.acertadas, huella(sesion.actual)],
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
    mostradas: [...sesion.mostradas, huella(reto)],
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

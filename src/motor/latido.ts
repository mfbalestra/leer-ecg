// Modelo de un latido y generación de tiras: el trazo se dibuja a partir de parámetros en
// milisegundos y milivoltios, y cada reto toma su respuesta de esos mismos parámetros.

import type { Azar } from './azar.ts'
import { rrPorFrecuencia } from './papel.ts'

export type ParametrosLatido = {
  /** Latidos por minuto; fija la distancia entre dos R cuando el ritmo es regular. */
  frecuencia: number
  /** Del inicio de la P al inicio del QRS. */
  prMs: number
  /** Duración de la onda P. */
  pMs: number
  qrsMs: number
  /** Del inicio del QRS al final de la T. */
  qtMs: number
  /** Duración de la onda T. */
  tMs: number
  pMv: number
  qMv: number
  rMv: number
  sMv: number
  tMv: number
  /** Desnivel del segmento ST respecto de la línea de base. */
  stMv: number
  pPresente: boolean
}

export const LATIDO_NORMAL: ParametrosLatido = {
  frecuencia: 75,
  prMs: 160,
  pMs: 90,
  qrsMs: 90,
  qtMs: 380,
  tMs: 170,
  pMv: 0.15,
  qMv: -0.1,
  rMv: 1.1,
  sMv: -0.25,
  tMv: 0.3,
  stMv: 0,
  pPresente: true,
}

export type Ritmo = 'regular' | 'sinusal-irregular' | 'irregular-sin-p'

/** Los tiempos absolutos, en milisegundos desde el inicio de la tira, de un latido ya ubicado. */
export type LatidoEnTira = {
  pInicioMs: number
  pFinMs: number
  qrsInicioMs: number
  rMs: number
  qrsFinMs: number
  tInicioMs: number
  tFinMs: number
  parametros: ParametrosLatido
}

export type Tira = {
  id: string
  duracionMs: number
  pasoMs: number
  /** Milivoltios muestreados cada `pasoMs`. */
  muestras: number[]
  latidos: LatidoEnTira[]
  ritmo: Ritmo
}

/** Fracción del QRS en la que cae el pico de la R. */
const PICO_R = 0.45

function interpolar(desde: number, hasta: number, u: number): number {
  return desde + (hasta - desde) * u
}

/** Forma del QRS: Q chica, R alta y S, como fracción `u` de su duración. */
function qrsEn(u: number, p: ParametrosLatido): number {
  if (u < 0.1) return interpolar(0, p.qMv, u / 0.1)
  if (u < 0.2) return interpolar(p.qMv, 0, (u - 0.1) / 0.1)
  if (u < PICO_R) return interpolar(0, p.rMv, (u - 0.2) / (PICO_R - 0.2))
  if (u < 0.7) return interpolar(p.rMv, 0, (u - PICO_R) / (0.7 - PICO_R))
  if (u < 0.85) return interpolar(0, p.sMv, (u - 0.7) / 0.15)
  return interpolar(p.sMv, p.stMv, (u - 0.85) / 0.15)
}

/** Milivoltios de un latido en el instante `t`, medido desde el inicio de su onda P. */
export function voltajeLatido(tMs: number, p: ParametrosLatido): number {
  if (tMs < 0) return 0
  if (tMs < p.pMs) {
    return p.pPresente ? p.pMv * Math.sin((Math.PI * tMs) / p.pMs) : 0
  }
  const qrsInicio = p.prMs
  if (tMs < qrsInicio) return 0
  const qrsFin = qrsInicio + p.qrsMs
  if (tMs < qrsFin) return qrsEn((tMs - qrsInicio) / p.qrsMs, p)
  const tInicio = qrsInicio + p.qtMs - p.tMs
  if (tMs < tInicio) return p.stMv
  const tFin = qrsInicio + p.qtMs
  if (tMs < tFin) {
    const u = (tMs - tInicio) / p.tMs
    return p.stMv * (1 - u) + p.tMv * Math.sin(Math.PI * Math.pow(u, 1.25))
  }
  return 0
}

function ubicarLatido(inicioMs: number, p: ParametrosLatido): LatidoEnTira {
  const qrsInicioMs = inicioMs + p.prMs
  return {
    pInicioMs: inicioMs,
    pFinMs: inicioMs + p.pMs,
    qrsInicioMs,
    rMs: qrsInicioMs + PICO_R * p.qrsMs,
    qrsFinMs: qrsInicioMs + p.qrsMs,
    tInicioMs: qrsInicioMs + p.qtMs - p.tMs,
    tFinMs: qrsInicioMs + p.qtMs,
    parametros: p,
  }
}

/** Ruido fino de línea de base para un ritmo sin onda P: dos senos de amplitud chica. */
function ondulacionBase(tMs: number, fase: number): number {
  return 0.035 * Math.sin(tMs / 28 + fase) + 0.025 * Math.sin(tMs / 17 + 2 * fase)
}

export type OpcionesTira = {
  duracionMs: number
  parametros: ParametrosLatido
  ritmo: Ritmo
  azar: Azar
  /** Inicio de la primera P, en milisegundos; si falta, se sortea dentro del primer RR. */
  inicioMs?: number
  pasoMs?: number
}

/** Cuánto se aparta el RR del sinusal irregular de su base, hacia arriba y hacia abajo. */
const VARIACION_SINUSAL = 0.14
/** El RR más corto del irregular sin P, como fracción del base; el más largo suma `AMPLITUD_SIN_P`. */
const MINIMO_SIN_P = 0.65
const AMPLITUD_SIN_P = 0.7

function siguienteRr(rrBase: number, ritmo: Ritmo, indice: number, azar: Azar): number {
  switch (ritmo) {
    case 'regular':
      return rrBase
    case 'sinusal-irregular':
      return rrBase * (1 + VARIACION_SINUSAL * Math.sin((indice * Math.PI) / 2.5))
    case 'irregular-sin-p':
      return rrBase * (MINIMO_SIN_P + AMPLITUD_SIN_P * azar.siguiente())
  }
}

/** El RR más corto que puede tocar en el ritmo: cada latido tiene que entrar ahí sin pisar la P siguiente. */
function rrMasCorto(rrBase: number, ritmo: Ritmo): number {
  switch (ritmo) {
    case 'regular':
      return rrBase
    case 'sinusal-irregular':
      return rrBase * (1 - VARIACION_SINUSAL)
    case 'irregular-sin-p':
      return rrBase * MINIMO_SIN_P
  }
}

/** Separación mínima entre el final de la T y la P siguiente. */
const RESPIRO_MS = 30

/**
 * Acomoda el latido a su frecuencia: el QT se acorta con la frecuencia (como en el corazón real,
 * proporcional a la raíz del RR) y nunca invade la P siguiente; la T se achica si hace falta para
 * que el QT siga midiendo al menos QRS + T. El PR y el QRS no cambian: son lo que se pregunta.
 */
export function ajustarAlRitmo(p: ParametrosLatido, rrMs: number): ParametrosLatido {
  const factor = Math.min(1, Math.sqrt(rrMs / 1000))
  let qtMs = Math.min(p.qtMs * factor, rrMs - p.prMs - RESPIRO_MS)
  qtMs = Math.max(qtMs, p.qrsMs + 40)
  const tMs = Math.min(p.tMs, qtMs - p.qrsMs)
  if (qtMs === p.qtMs && tMs === p.tMs) return p
  return { ...p, qtMs, tMs }
}

/** Si un ritmo lleva onda P antes de cada QRS: sólo el irregular sin P la pierde. */
export function ritmoTieneP(ritmo: Ritmo): boolean {
  return ritmo !== 'irregular-sin-p'
}

export function generarTira(opciones: OpcionesTira): Tira {
  const { duracionMs, ritmo, azar } = opciones
  const pasoMs = opciones.pasoMs ?? 2
  const rrBase = rrPorFrecuencia(opciones.parametros.frecuencia)
  const parametros: ParametrosLatido = ajustarAlRitmo(
    ritmoTieneP(ritmo) ? opciones.parametros : { ...opciones.parametros, pPresente: false },
    rrMasCorto(rrBase, ritmo),
  )
  const fase = azar.siguiente() * Math.PI * 2
  const inicio = opciones.inicioMs ?? azar.siguiente() * rrBase * 0.6

  const latidos: LatidoEnTira[] = []
  let t = inicio
  let indice = 0
  // Un latido más allá del final para que el trazo no termine en línea plana antes de tiempo.
  while (t < duracionMs + rrBase) {
    latidos.push(ubicarLatido(t, parametros))
    t += siguienteRr(rrBase, ritmo, indice, azar)
    indice += 1
  }

  const cantidad = Math.floor(duracionMs / pasoMs) + 1
  const muestras: number[] = new Array<number>(cantidad)
  for (let i = 0; i < cantidad; i += 1) {
    const tMs = i * pasoMs
    let mv = 0
    for (const latido of latidos) {
      if (tMs >= latido.pInicioMs && tMs < latido.tFinMs + 1) {
        mv += voltajeLatido(tMs - latido.pInicioMs, parametros)
      }
    }
    if (!parametros.pPresente) mv += ondulacionBase(tMs, fase)
    muestras[i] = mv
  }

  return {
    id: `tira-${Math.floor(azar.siguiente() * 1e9)}`,
    duracionMs,
    pasoMs,
    muestras,
    latidos: latidos.filter((l) => l.pInicioMs < duracionMs),
    ritmo,
  }
}

/** Los latidos cuya R cae dentro de la tira, en orden. */
export function latidosVisibles(tira: Tira): LatidoEnTira[] {
  return tira.latidos.filter((l) => l.rMs >= 0 && l.rMs <= tira.duracionMs)
}

/** Cuántos QRS caen dentro de una ventana de la tira (R entre `desdeMs` y `hastaMs`). */
export function contarQrs(tira: Tira, desdeMs: number, hastaMs: number): number {
  return tira.latidos.filter((l) => l.rMs >= desdeMs && l.rMs <= hastaMs).length
}

export type NombreRegion = 'p' | 'pr-segmento' | 'qrs' | 'st' | 't' | 'pr-intervalo' | 'qt'

export type RegionLatido = { nombre: NombreRegion; desdeMs: number; hastaMs: number }

/** Las regiones del latido con sus tiempos absolutos en la tira. */
export function regionesLatido(l: LatidoEnTira): Record<NombreRegion, RegionLatido> {
  return {
    p: { nombre: 'p', desdeMs: l.pInicioMs, hastaMs: l.pFinMs },
    'pr-segmento': { nombre: 'pr-segmento', desdeMs: l.pFinMs, hastaMs: l.qrsInicioMs },
    qrs: { nombre: 'qrs', desdeMs: l.qrsInicioMs, hastaMs: l.qrsFinMs },
    st: { nombre: 'st', desdeMs: l.qrsFinMs, hastaMs: l.tInicioMs },
    t: { nombre: 't', desdeMs: l.tInicioMs, hastaMs: l.tFinMs },
    'pr-intervalo': { nombre: 'pr-intervalo', desdeMs: l.pInicioMs, hastaMs: l.qrsInicioMs },
    qt: { nombre: 'qt', desdeMs: l.qrsInicioMs, hastaMs: l.tFinMs },
  }
}

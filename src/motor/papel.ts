// El papel del electrocardiograma: velocidad, ganancia y lo que mide cada cuadrado.
// Fuentes: `FUENTES.papel` y `FUENTES.calibracion` en `valores.ts`.

/** Velocidad estándar del papel, en milímetros por segundo. */
export const VELOCIDAD_MM_POR_S = 25

/** Ganancia estándar: cuántos milímetros sube el trazo por cada milivoltio. */
export const GANANCIA_MM_POR_MV = 10

/** Lado de un cuadrado chico, en milímetros. */
export const CUADRADO_CHICO_MM = 1

/** Lado de un cuadrado grande, en milímetros (cinco chicos). */
export const CUADRADO_GRANDE_MM = 5

/** Un cuadrado chico de ancho equivale a 40 ms a 25 mm/s. */
export const MS_POR_CUADRADO_CHICO = 40

/** Un cuadrado grande de ancho equivale a 200 ms a 25 mm/s. */
export const MS_POR_CUADRADO_GRANDE = 200

/** Un cuadrado chico de alto equivale a 0,1 mV con ganancia de 10 mm/mV. */
export const MV_POR_CUADRADO_CHICO = 0.1

/** Cuadrados grandes que caben en un minuto a 25 mm/s. */
export const CUADRADOS_GRANDES_POR_MINUTO = 300

/** Cuadrados chicos que caben en un minuto a 25 mm/s. */
export const CUADRADOS_CHICOS_POR_MINUTO = 1500

export function msAMm(ms: number): number {
  return (ms / 1000) * VELOCIDAD_MM_POR_S
}

export function mvAMm(mv: number): number {
  return mv * GANANCIA_MM_POR_MV
}

/** Cuadrados chicos que ocupa una duración. */
export function cuadradosChicos(ms: number): number {
  return ms / MS_POR_CUADRADO_CHICO
}

/** Regla de los cuadrados grandes: 300 dividido los cuadrados grandes entre dos R. */
export function frecuenciaPorCuadradosGrandes(cuadrados: number): number {
  return CUADRADOS_GRANDES_POR_MINUTO / cuadrados
}

/** Método de conteo: los QRS contados en una ventana de segundos, llevados a un minuto. */
export function frecuenciaPorConteo(qrsContados: number, ventanaS: number): number {
  return (qrsContados * 60) / ventanaS
}

/** Distancia entre dos R, en milisegundos, para una frecuencia. */
export function rrPorFrecuencia(lpm: number): number {
  return 60000 / lpm
}

/** La secuencia que se memoriza: 1, 2, 3, 4, 5 y 6 cuadrados grandes entre dos R. */
export const SECUENCIA_300 = [300, 150, 100, 75, 60, 50] as const

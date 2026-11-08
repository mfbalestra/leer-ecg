// La regla con la que una tira se ajusta a una caja: limitada por el ancho o por el alto, sin
// deformar el papel (25 mm/s, 10 mm/mV). La usan la tira ancha de escritorio y la tira apaisada.

import type { Tira } from '@/motor/latido'
import { msAMm } from '@/motor/papel'

/** Alto del papel de una tira, en milímetros, si no se pide otro. */
export const ALTO_TIRA_MM = 24

/**
 * Ancho con el que una tira de `altoMm` mide `alto` de alto (una longitud CSS). Los 2 px son el
 * borde del papel, que no escala con la tira.
 */
export function anchoParaAlto(tira: Tira, alto: string, altoMm = ALTO_TIRA_MM): string {
  const proporcion = msAMm(tira.duracionMs) / altoMm
  return `calc((${alto} - 2px) * ${proporcion} + 2px)`
}

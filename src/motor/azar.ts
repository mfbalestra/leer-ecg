// Azar con semilla: cada reto se puede reproducir en un test a partir de su semilla.

export type Azar = {
  /** Número en [0, 1). */
  siguiente: () => number
  /** Entero entre `minimo` y `maximo`, ambos incluidos. */
  entero: (minimo: number, maximo: number) => number
  elegir: <T>(lista: readonly T[]) => T
  mezclar: <T>(lista: readonly T[]) => T[]
}

/** Generador mulberry32: chico, determinista y suficiente para elegir retos. */
export function crearAzar(semilla: number): Azar {
  let estado = semilla >>> 0
  const siguiente = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const entero = (minimo: number, maximo: number): number =>
    minimo + Math.floor(siguiente() * (maximo - minimo + 1))
  const elegir = <T>(lista: readonly T[]): T => {
    const elegido = lista[entero(0, lista.length - 1)]
    if (elegido === undefined) throw new Error('No se puede elegir de una lista vacía')
    return elegido
  }
  const mezclar = <T>(lista: readonly T[]): T[] => {
    const copia = [...lista]
    for (let i = copia.length - 1; i > 0; i -= 1) {
      const j = entero(0, i)
      const a = copia[i]
      const b = copia[j]
      if (a !== undefined && b !== undefined) {
        copia[i] = b
        copia[j] = a
      }
    }
    return copia
  }
  return { siguiente, entero, elegir, mezclar }
}

/** Semilla distinta por llamada, a partir del reloj y de un contador, sin depender de Math.random. */
export function semillaDesde(base: number, contador: number): number {
  return (Math.floor(base) ^ Math.imul(contador + 1, 2654435761)) >>> 0
}

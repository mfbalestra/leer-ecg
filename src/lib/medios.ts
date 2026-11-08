// Consultas de medios como estado de React: el componente se vuelve a dibujar cuando la consulta
// cambia (girar el teléfono, cambiar el tamaño de la ventana).
//
// Uso: const vertical = useCoincide('(orientation: portrait)')

import { useCallback, useSyncExternalStore } from 'react'

/** El teléfono girado de verdad: apaisado, bajo y con dedo. Abre la tira apaisada sola. */
export const TELEFONO_APAISADO =
  '(orientation: landscape) and (max-height: 500px) and (pointer: coarse)'

export const VERTICAL = '(orientation: portrait)'

/** Desde 768 px de ancho (`md` de Tailwind): la tira sale de la columna de lectura. */
export const ANCHO_ESCRITORIO = '(min-width: 48rem)'

export function useCoincide(consulta: string): boolean {
  const suscribir = useCallback(
    (aviso: () => void) => {
      const lista = window.matchMedia(consulta)
      lista.addEventListener('change', aviso)
      return () => lista.removeEventListener('change', aviso)
    },
    [consulta],
  )
  return useSyncExternalStore(
    suscribir,
    () => window.matchMedia(consulta).matches,
    () => false,
  )
}

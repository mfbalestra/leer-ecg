// Las opciones de un reto como botones grandes. Después de responder, la correcta queda marcada con
// un tilde y la elegida incorrecta con una cruz: el estado nunca depende sólo del color. Con
// `atajos`, la tecla de cada posición (1, 2, 3…) elige esa opción mientras no se respondió, y con
// mouse o trackpad cada opción muestra su número.
//
// Uso: <Opciones opciones={reto.respuesta.opciones} onElegir={(id) => responder(id)} />
//      <Opciones … disposicion="fila" />  en la tira apaisada: una sola fila, mismos anchos.
//      <Opciones … atajos />  en la vista que se ve (una sola a la vez: el atajo escucha la página).
// Estados: en curso (con o sin número a la vista), respondida (elegida correcta / elegida
// incorrecta / correcta no elegida; los atajos se apagan y el número se oculta sin mover el texto).

import { CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useEffectEvent } from 'react'

import { cn } from '@/lib/utils'
import type { Opcion } from '@/motor/retos'

/**
 * Teclas de atajo: la primera elige la primera opción, y así con cada una. Todas las opciones
 * llevan número (la regla del 300 tiene seis); nueve alcanzan para cualquier reto.
 */
const TECLAS_ATAJO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/** Un campo donde se escribe: ahí un dígito es texto, no un atajo. */
function esCampoDeTexto(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false
  return (
    destino.isContentEditable ||
    destino instanceof HTMLInputElement ||
    destino instanceof HTMLTextAreaElement ||
    destino instanceof HTMLSelectElement
  )
}

type PropsBoton = {
  opcion: Opcion
  /** La tecla que la elige, si hay atajos. */
  tecla: string | undefined
  fila: boolean
  resuelta: boolean
  elegida: boolean
  esCorrecta: boolean
  onElegir: (id: string) => void
}

function BotonOpcion({ opcion, tecla, fila, resuelta, elegida, esCorrecta, onElegir }: PropsBoton) {
  const esError = resuelta && elegida && !esCorrecta
  return (
    <button
      type="button"
      className={cn(
        'cuerpo flex min-h-11 items-center gap-3 rounded-lg border bg-superficie px-4 py-2 font-medium transition-colors duration-(--duracion-breve) ease-(--curva) outline-none',
        fila ? 'min-w-11 flex-1 basis-0 justify-center text-center' : 'justify-between text-left',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
        !resuelta && 'hover:border-primario hover:bg-primario-suave',
        resuelta && 'cursor-default',
        esCorrecta && 'border-exito bg-exito-suave text-exito',
        esError && 'border-peligro bg-peligro-suave text-peligro',
      )}
      aria-pressed={elegida}
      aria-keyshortcuts={tecla && !resuelta ? tecla : undefined}
      disabled={resuelta}
      onClick={() => onElegir(opcion.id)}
    >
      <span className="flex items-center gap-3">
        {tecla && (
          // El nombre del botón sigue siendo la opción: el número es una pista visual.
          <kbd
            className={cn(
              'pequeno hidden size-6 shrink-0 items-center justify-center rounded-sm border border-borde font-sans font-medium text-texto-tenue tabular-nums raton:inline-flex',
              resuelta && 'invisible',
            )}
            aria-hidden="true"
          >
            {tecla}
          </kbd>
        )}
        <span>{opcion.etiqueta}</span>
      </span>
      {esCorrecta && <CircleCheck className="size-5 shrink-0" aria-hidden="true" />}
      {esError && <CircleX className="size-5 shrink-0" aria-hidden="true" />}
    </button>
  )
}

type Props = {
  opciones: readonly Opcion[]
  elegida: string | null
  correcta: string | null
  onElegir: (id: string) => void
  /** `columnas`: apiladas en el celular y en dos columnas desde `sm`. `fila`: todas en una fila,
   * del mismo ancho y con el texto centrado (el modo de tira apaisada). */
  disposicion?: 'columnas' | 'fila'
  /**
   * Cada opción se elige con la tecla de su posición, y el número se ve con un puntero fino que se
   * posa (mouse, trackpad).
   */
  atajos?: boolean
}

export function Opciones({
  opciones,
  elegida,
  correcta,
  onElegir,
  disposicion = 'columnas',
  atajos = false,
}: Props) {
  const resuelta = elegida !== null
  const fila = disposicion === 'fila'

  const alPulsar = useEffectEvent((evento: KeyboardEvent) => {
    if (evento.repeat || evento.isComposing || evento.defaultPrevented) return
    if (evento.ctrlKey || evento.altKey || evento.metaKey) return
    if (esCampoDeTexto(evento.target)) return
    const posicion = TECLAS_ATAJO.findIndex((tecla) => tecla === evento.key)
    const opcion = opciones[posicion]
    if (posicion < 0 || !opcion) return
    evento.preventDefault()
    onElegir(opcion.id)
  })
  useEffect(() => {
    if (!atajos || resuelta) return
    const escuchar = (evento: KeyboardEvent) => alPulsar(evento)
    document.addEventListener('keydown', escuchar)
    return () => document.removeEventListener('keydown', escuchar)
  }, [atajos, resuelta])

  return (
    <div
      className={fila ? 'flex w-full gap-2' : 'grid gap-2 sm:grid-cols-2'}
      role="group"
      aria-label="Opciones"
    >
      {opciones.map((opcion, i) => (
        <BotonOpcion
          key={opcion.id}
          opcion={opcion}
          tecla={atajos ? TECLAS_ATAJO[i] : undefined}
          fila={fila}
          resuelta={resuelta}
          elegida={elegida === opcion.id}
          esCorrecta={resuelta && correcta === opcion.id}
          onElegir={onElegir}
        />
      ))}
    </div>
  )
}

// Las opciones de un reto como botones grandes. Después de responder, la correcta queda marcada con
// un tilde y la elegida incorrecta con una cruz: el estado nunca depende sólo del color.
//
// Uso: <Opciones opciones={reto.respuesta.opciones} onElegir={(id) => responder(id)} />
// Estados: en curso, respondida (elegida correcta / elegida incorrecta / correcta no elegida).

import { CircleCheck, CircleX } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Opcion } from '@/motor/retos'

type Props = {
  opciones: readonly Opcion[]
  elegida: string | null
  correcta: string | null
  onElegir: (id: string) => void
}

export function Opciones({ opciones, elegida, correcta, onElegir }: Props) {
  const resuelta = elegida !== null
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Opciones">
      {opciones.map((opcion) => {
        const esCorrecta = resuelta && correcta === opcion.id
        const esError = resuelta && elegida === opcion.id && correcta !== opcion.id
        return (
          <button
            key={opcion.id}
            type="button"
            className={cn(
              'cuerpo flex min-h-11 items-center justify-between gap-3 rounded-lg border bg-superficie px-4 py-2 text-left font-medium transition-colors duration-(--duracion-breve) ease-(--curva) outline-none',
              'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
              !resuelta && 'hover:border-primario hover:bg-primario-suave',
              resuelta && 'cursor-default',
              esCorrecta && 'border-exito bg-exito-suave text-exito',
              esError && 'border-peligro bg-peligro-suave text-peligro',
            )}
            aria-pressed={elegida === opcion.id}
            disabled={resuelta}
            onClick={() => onElegir(opcion.id)}
          >
            <span>{opcion.etiqueta}</span>
            {esCorrecta && <CircleCheck className="size-5 shrink-0" aria-hidden="true" />}
            {esError && <CircleX className="size-5 shrink-0" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

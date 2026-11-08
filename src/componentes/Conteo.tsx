// Un contador para responder «¿cuántos?»: menos, más y responder. Los botones miden 44 px en el
// celular; el valor se lee como una cifra grande.
//
// Uso: <Conteo minimo={0} maximo={20} unidad="QRS" onResponder={(n) => responder(n)} />
//      <Conteo … tactil />  en la tira apaisada: los tres botones miden 44 px a cualquier ancho.
// Estados: en curso, respondido (deshabilitado, muestra el valor dado).

import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { numero } from '@/motor/formato'

type Props = {
  minimo: number
  maximo: number
  unidad: string
  deshabilitado?: boolean
  /** Fija los botones en 44 px aunque el ancho y el puntero permitieran el tamaño de escritorio. */
  tactil?: boolean
  onResponder: (valor: number) => void
}

export function Conteo({
  minimo,
  maximo,
  unidad,
  deshabilitado = false,
  tactil = false,
  onResponder,
}: Props) {
  const piso = tactil ? 'min-h-11 min-w-11' : undefined
  const [valor, setValor] = useState(minimo)
  const cambiar = (delta: number) => {
    setValor((v) => Math.min(maximo, Math.max(minimo, v + delta)))
  }
  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="group"
      aria-label={`Contador de ${unidad}`}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className={piso}
          aria-label="Uno menos"
          disabled={deshabilitado || valor <= minimo}
          onClick={() => cambiar(-1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output
          className="cifra min-w-14 text-center tabular-nums"
          aria-label={`${numero(valor)} ${unidad}`}
          aria-live="polite"
        >
          {numero(valor)}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className={piso}
          aria-label="Uno más"
          disabled={deshabilitado || valor >= maximo}
          onClick={() => cambiar(1)}
        >
          <Plus aria-hidden="true" />
        </Button>
        <span className="cuerpo text-texto-tenue">{unidad}</span>
      </div>
      <Button
        type="button"
        size="lg"
        className={piso}
        disabled={deshabilitado}
        onClick={() => onResponder(valor)}
      >
        Responder
      </Button>
    </div>
  )
}

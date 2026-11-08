// La tira apaisada: un diálogo de pantalla completa para leer y responder un reto con tira a lo
// largo del teléfono. Con la pantalla ya apaisada el contenido va derecho; con la pantalla en
// vertical el contenido gira 90° en el sentido del reloj y la persona gira el teléfono a la
// izquierda. Es otra vista del mismo reto: la pantalla del nivel le pasa la respuesta, el
// resultado y «Siguiente», y decide cuándo se abre y se cierra.
//
// Uso:
//   <ModoApaisado abierto girada={vertical} reto={reto} refTitulo={titulo} onSalir={salir}
//     focoFinal={() => boton.current} respuesta={<Opciones … disposicion="fila" />}
//     resultado={null} siguiente={null} />
// Estados: pregunta (respuesta abajo), respondida (resultado y «Siguiente» en la misma franja de
// 72 px, así la tira no salta), derecha o girada.

import { X } from 'lucide-react'
import type { CSSProperties, ReactNode, RefObject } from 'react'

import { TiraEcg } from '@/componentes/TiraEcg'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FOCO_PROGRAMATICO } from '@/lib/foco'
import { segundos } from '@/motor/formato'
import { msAMm } from '@/motor/papel'
import type { Reto } from '@/motor/retos'

/** Alto del papel de una tira, en milímetros: el mismo que `TiraEcg` usa por omisión. */
const ALTO_MM = 24

/** La tira lo más grande posible dentro de su zona: limitada por el ancho o por el alto, sin desbordar. */
function TiraAjustada({ reto, pulso }: { reto: Reto; pulso: boolean }) {
  if (reto.vista.tipo !== 'tira') return null
  const tira = reto.vista.tira
  const proporcion = msAMm(tira.duracionMs) / ALTO_MM
  return (
    <div
      className="flex min-h-0 flex-1 items-center justify-center"
      style={{ containerType: 'size' }}
      data-zona="tira"
    >
      {/* Los 2 px son el borde del papel, que no escala con la tira. */}
      <div style={{ width: `min(100cqw, calc((100cqh - 2px) * ${proporcion} + 2px))` }}>
        <TiraEcg
          tira={tira}
          etiqueta={`Tira de ${segundos(tira.duracionMs / 1000, 0)} sobre papel milimetrado`}
          marcas={reto.marcas}
          pulso={pulso}
        />
      </div>
    </div>
  )
}

// Las zonas seguras siguen al giro: girado, el borde de arriba del teléfono (la isla o el notch)
// queda a la izquierda del contenido. Valen 0 sin `viewport-fit=cover`; el mínimo es el de la página.
const RELLENO_DERECHO: CSSProperties = {
  paddingTop: 'max(env(safe-area-inset-top), calc(var(--spacing) * 2))',
  paddingBottom: 'max(env(safe-area-inset-bottom), calc(var(--spacing) * 2))',
  paddingLeft: 'max(env(safe-area-inset-left), calc(var(--spacing) * 3))',
  paddingRight: 'max(env(safe-area-inset-right), calc(var(--spacing) * 3))',
}
const RELLENO_GIRADO: CSSProperties = {
  paddingTop: 'max(env(safe-area-inset-right), calc(var(--spacing) * 2))',
  paddingBottom: 'max(env(safe-area-inset-left), calc(var(--spacing) * 2))',
  paddingLeft: 'max(env(safe-area-inset-top), calc(var(--spacing) * 3))',
  paddingRight: 'max(env(safe-area-inset-bottom), calc(var(--spacing) * 3))',
}

type Props = {
  abierto: boolean
  /** La pantalla está en vertical: el contenido gira 90° en el sentido del reloj. */
  girada: boolean
  reto: Reto
  /** El trazo late al acertar. */
  pulso: boolean
  /** El enunciado: recibe el foco al abrir y en cada reto nuevo. */
  refTitulo: RefObject<HTMLHeadingElement | null>
  /** «Salir», Escape. */
  onSalir: () => void
  /** Dónde queda el foco al cerrar. */
  focoFinal: () => HTMLElement | null
  /** La respuesta del reto, mientras no se respondió. */
  respuesta: ReactNode
  /** El resultado, una vez respondido (`null` mientras tanto); va en la región `status`. */
  resultado: ReactNode | null
  /** «Siguiente» o «Ver resultado», una vez respondido. */
  siguiente: ReactNode
}

export function ModoApaisado({
  abierto,
  girada,
  reto,
  pulso,
  refTitulo,
  onSalir,
  focoFinal,
  respuesta,
  resultado,
  siguiente,
}: Props) {
  const respondido = resultado !== null
  return (
    <Dialog
      open={abierto}
      onOpenChange={(abrir) => {
        if (!abrir) onSalir()
      }}
    >
      <DialogContent
        variant="fullscreen"
        showCloseButton={false}
        initialFocus={refTitulo}
        finalFocus={() => focoFinal() ?? true}
        style={{ containerType: 'size' }}
        aria-describedby={undefined}
      >
        <div
          className={
            girada
              ? 'absolute top-0 left-0 h-[100cqw] w-[100cqh] origin-top-left translate-x-[100cqw] rotate-90'
              : 'absolute inset-0'
          }
          data-marco={girada ? 'girado' : 'derecho'}
        >
          <div
            className="flex h-full flex-col gap-3"
            style={girada ? RELLENO_GIRADO : RELLENO_DERECHO}
          >
            <div className="flex items-center gap-3">
              <DialogTitle
                variant="plain"
                ref={refTitulo}
                tabIndex={-1}
                className={cn('enunciado grow', FOCO_PROGRAMATICO)}
              >
                {reto.enunciado}
              </DialogTitle>
              <DialogClose
                render={<Button variant="outline" size="lg" className="min-h-11 shrink-0 px-3" />}
              >
                <X data-icon="inline-start" aria-hidden="true" />
                Salir
              </DialogClose>
            </div>

            <TiraAjustada reto={reto} pulso={pulso} />

            {/* La franja de la respuesta reserva 72 px: al responder, el resultado y «Siguiente»
                ocupan su lugar sin mover la tira. */}
            <div className="flex min-h-18 items-end">
              <div className="flex w-full items-center gap-3">
                <div
                  role="status"
                  aria-label="Resultado del reto"
                  aria-live="polite"
                  className={respondido ? 'grow' : 'sr-only'}
                >
                  {respondido && resultado}
                </div>
                {respondido ? siguiente : <div className="grow">{respuesta}</div>}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// La portada: los cinco niveles con su estado, el mejor examen y el acceso a los valores de
// referencia. Lo que pide acción (el siguiente nivel) lleva el botón primario.

import { BookOpen, CircleCheck, Flame, Timer } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { TiraEcg } from '@/componentes/TiraEcg'
import { Button } from '@/components/ui/button'
import { crearAzar } from '@/motor/azar'
import { numero, segundos } from '@/motor/formato'
import { LATIDO_NORMAL, generarTira } from '@/motor/latido'
import { siguienteNivel, type Progreso } from '@/motor/progreso'
import { NIVELES, type NivelId } from '@/motor/retos'
import { FOCO_PROGRAMATICO } from '@/lib/foco'

type Props = {
  progreso: Progreso
  onJugar: (nivel: NivelId) => void
  onReferencias: () => void
}

const ORDEN: readonly NivelId[] = NIVELES.map((n) => n.id)

/** La tira de la portada: siempre la misma, para que la pantalla se reconozca. */
const tiraPortada = generarTira({
  duracionMs: 4000,
  parametros: LATIDO_NORMAL,
  ritmo: 'regular',
  azar: crearAzar(2026),
  inicioMs: 300,
})

export function Inicio({ progreso, onJugar, onReferencias }: Props) {
  const siguiente = siguienteNivel(progreso, ORDEN)
  const mejorRacha = Math.max(...ORDEN.map((id) => progreso.niveles[id].mejorRacha))
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus()
  }, [])
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div>
          <h1 ref={titulo} tabIndex={-1} className={`display ${FOCO_PROGRAMATICO}`}>
            Entrenador de ECG
          </h1>
          <p className="cuerpo mt-2 max-w-prose text-texto-tenue">
            Retos de medio minuto para aprender a leer un electrocardiograma: el papel, un latido,
            la frecuencia, el ritmo y la lectura completa. Si errás, vuelve con otros números.
          </p>
        </div>
        <TiraEcg
          tira={tiraPortada}
          etiqueta="Un trazado normal de cuatro segundos sobre papel milimetrado"
        />
      </header>

      <section aria-labelledby="titulo-niveles" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-niveles" className="titulo">
            Niveles
          </h2>
          {mejorRacha > 0 && (
            <p className="pequeno flex items-center gap-1 text-racha">
              <Flame className="size-4" aria-hidden="true" />
              Mejor racha: <span className="tabular-nums">{numero(mejorRacha)}</span>
            </p>
          )}
        </div>
        <ol className="flex flex-col gap-3">
          {NIVELES.map((nivel) => {
            const estado = progreso.niveles[nivel.id]
            const esSiguiente = siguiente === nivel.id
            return (
              <li
                key={nivel.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-superficie p-4"
              >
                <span
                  className="cifra flex size-11 shrink-0 items-center justify-center rounded-full bg-primario-suave tabular-nums"
                  aria-hidden="true"
                >
                  {nivel.numero}
                </span>
                <div className="min-w-0 grow basis-48">
                  <h3 className="cuerpo font-semibold">
                    <span className="sr-only">Nivel {nivel.numero}: </span>
                    {nivel.titulo}
                  </h3>
                  <p className="pequeno text-texto-tenue">{nivel.descripcion}</p>
                  {estado.completado && (
                    <p className="pequeno mt-1 flex items-center gap-1 text-exito">
                      <CircleCheck className="size-4" aria-hidden="true" />
                      Completado
                      {estado.mejorRacha > 0 ? `, racha ${numero(estado.mejorRacha)}` : ''}
                    </p>
                  )}
                  {nivel.id === 'lectura' && progreso.examen.total > 0 && (
                    <p className="pequeno mt-1 flex items-center gap-1 text-texto-tenue">
                      <Timer className="size-4" aria-hidden="true" />
                      Mejor: {numero(progreso.examen.mejorAciertos)} de{' '}
                      {numero(progreso.examen.total)}
                      {progreso.examen.mejorSegundos !== null
                        ? ` en ${segundos(progreso.examen.mejorSegundos, 0)}`
                        : ''}
                    </p>
                  )}
                </div>
                <Button
                  size="lg"
                  variant={esSiguiente ? 'default' : 'outline'}
                  onClick={() => onJugar(nivel.id)}
                  aria-label={`${estado.completado ? 'Repasar' : 'Empezar'} nivel ${nivel.numero}: ${nivel.titulo}`}
                >
                  {estado.completado ? 'Repasar' : 'Empezar'}
                </Button>
              </li>
            )
          })}
        </ol>
      </section>

      <footer className="flex flex-col gap-3 border-t pt-4">
        <p className="pequeno text-texto-tenue">
          Material de estudio: no reemplaza la formación clínica ni la lectura por un profesional.
          Versión {__VERSION__}.
        </p>
        <Button variant="link" className="w-fit px-0" onClick={onReferencias}>
          <BookOpen data-icon="inline-start" aria-hidden="true" />
          Valores normales y fuentes
        </Button>
      </footer>
    </div>
  )
}

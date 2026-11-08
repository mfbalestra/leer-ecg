// Los valores normales que enseña el entrenador, con la fuente de cada uno, tal como se leyeron.

import { ArrowLeft, ExternalLink } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { milisegundos, numero } from '@/motor/formato'
import {
  CUADRADOS_CHICOS_POR_MINUTO,
  CUADRADOS_GRANDES_POR_MINUTO,
  CUADRADO_CHICO_MM,
  CUADRADO_GRANDE_MM,
  GANANCIA_MM_POR_MV,
  MS_POR_CUADRADO_CHICO,
  MS_POR_CUADRADO_GRANDE,
  MV_POR_CUADRADO_CHICO,
  VELOCIDAD_MM_POR_S,
} from '@/motor/papel'
import { FUENTES, NORMAL, type Fuente } from '@/motor/valores'
import { FOCO_PROGRAMATICO } from '@/lib/foco'

type Fila = { valor: string; dato: string; fuente: Fuente }

const FILAS: Fila[] = [
  { valor: 'Velocidad del papel', dato: `${VELOCIDAD_MM_POR_S} mm/s`, fuente: FUENTES.papel },
  {
    valor: 'Cuadrado chico',
    dato: `${CUADRADO_CHICO_MM} mm = ${milisegundos(MS_POR_CUADRADO_CHICO)}`,
    fuente: FUENTES.papel,
  },
  {
    valor: 'Cuadrado grande',
    dato: `${CUADRADO_GRANDE_MM} mm = ${milisegundos(MS_POR_CUADRADO_GRANDE)}`,
    fuente: FUENTES.papel,
  },
  {
    valor: 'Ganancia',
    dato: `${GANANCIA_MM_POR_MV} mm/mV: ${CUADRADO_CHICO_MM} mm = ${numero(MV_POR_CUADRADO_CHICO, 1)} mV`,
    fuente: FUENTES.calibracion,
  },
  {
    valor: 'Regla del 300',
    dato: `${numero(CUADRADOS_GRANDES_POR_MINUTO)} ÷ cuadrados grandes entre dos R; ${numero(CUADRADOS_CHICOS_POR_MINUTO)} ÷ cuadrados chicos`,
    fuente: FUENTES.frecuenciaMetodos,
  },
  {
    valor: 'Método de conteo',
    dato: 'QRS contados × 60 ÷ segundos de la ventana: la fuente lo muestra con 10 s × 6; acá, 6 s × 10',
    fuente: FUENTES.conteo,
  },
  {
    valor: 'Bradicardia sinusal',
    dato: `< ${NORMAL.frecuencia.minLpm} lpm`,
    fuente: FUENTES.bradicardia,
  },
  {
    valor: 'Taquicardia sinusal',
    dato: `> ${NORMAL.frecuencia.maxLpm} lpm`,
    fuente: FUENTES.taquicardia,
  },
  {
    valor: 'Intervalo PR',
    dato: `${milisegundos(NORMAL.pr.minMs)} a ${milisegundos(NORMAL.pr.maxMs)}; más largo, bloqueo AV de primer grado`,
    fuente: FUENTES.pr,
  },
  {
    valor: 'QRS',
    dato: `hasta ${milisegundos(NORMAL.qrs.maxMs)}; más de ${milisegundos(NORMAL.qrs.bloqueoMs)}, bloqueo de rama`,
    fuente: FUENTES.qrs,
  },
  {
    valor: 'Onda P',
    dato: `< ${milisegundos(NORMAL.ondaP.maxMs)} y < ${numero(NORMAL.ondaP.maxMm, 1)} mm en derivaciones de miembros`,
    fuente: FUENTES.ondaP,
  },
  {
    valor: 'QT corregido',
    dato: `prolongado si > ${milisegundos(NORMAL.qtc.maxHombresMs)} (hombres) o > ${milisegundos(NORMAL.qtc.maxMujeresMs)} (mujeres); Bazett: QT ÷ √RR`,
    fuente: FUENTES.qt,
  },
  { valor: 'Punto J', dato: 'donde termina el QRS y empieza el ST', fuente: FUENTES.puntoJ },
  {
    valor: 'Segmento ST',
    dato: 'tramo plano entre el punto J y el inicio de la T',
    fuente: FUENTES.st,
  },
]

export function Referencias({ onVolver }: { onVolver: () => void }) {
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    titulo.current?.focus()
  }, [])
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onVolver}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Inicio
        </Button>
        <h1 ref={titulo} tabIndex={-1} className={`titulo ${FOCO_PROGRAMATICO}`}>
          Valores normales y fuentes
        </h1>
      </header>
      <p className="cuerpo max-w-prose text-texto-tenue">
        Cada valor que se enseña sale de una página de referencia leída el 7 de noviembre de 2026,
        con el texto tal como estaba. En adultos; los valores pediátricos son otros.
      </p>
      <div className="rounded-xl border bg-superficie">
        {/* En el celular la tabla se apila por fila; los roles explícitos conservan su semántica. */}
        <table role="table" className="w-full border-collapse text-left max-sm:block">
          <thead role="rowgroup" className="max-sm:hidden">
            <tr role="row" className="pequeno border-b text-texto-tenue">
              <th scope="col" role="columnheader" className="px-3 py-3 font-medium sm:px-4">
                Qué
              </th>
              <th scope="col" role="columnheader" className="px-3 py-3 font-medium sm:px-4">
                Valor
              </th>
              <th scope="col" role="columnheader" className="px-3 py-3 font-medium sm:px-4">
                Fuente
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup" className="max-sm:block">
            {FILAS.map((fila) => (
              <tr
                key={fila.valor}
                role="row"
                className="cuerpo border-b last:border-b-0 max-sm:block max-sm:px-4 max-sm:py-3"
              >
                <th
                  scope="row"
                  role="rowheader"
                  className="px-3 py-3 align-top font-semibold max-sm:block max-sm:p-0 sm:px-4"
                >
                  {fila.valor}
                </th>
                <td role="cell" className="px-3 py-3 align-top max-sm:block max-sm:p-0 sm:px-4">
                  {fila.dato}
                </td>
                <td
                  role="cell"
                  className="px-3 py-3 align-top max-sm:block max-sm:p-0 max-sm:pt-1 sm:px-4"
                >
                  <a
                    href={fila.fuente.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primario underline-offset-4 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {fila.fuente.titulo}
                    <ExternalLink
                      className="ml-1 inline size-4 align-text-bottom"
                      aria-hidden="true"
                    />
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="pequeno text-texto-tenue">
        Material de estudio: no reemplaza la formación clínica ni la lectura por un profesional.
      </p>
    </div>
  )
}

// El papel milimetrado con el trazado encima. Dibuja en milímetros reales (25 mm/s, 10 mm/mV) y
// escala con el ancho disponible; las marcas y las zonas para tocar van como HTML sobre el SVG,
// así sus textos no se achican con el papel y las zonas son botones de verdad.
//
// Uso:
//   <TiraEcg tira={tira} etiqueta="Tira de seis segundos" marcas={marcas} />
//   <TiraEcg … evidencia={respondida ? reto.evidencia : []} />  la prueba de la respuesta
//   <TiraEcg tira={tira} etiqueta="Un latido" zonas={zonas} onZona={(id) => responder(id)} />
// Estados: zonas en reposo, con foco, elegida correcta, elegida incorrecta y deshabilitadas; sin
// evidencia o con ella (tramos sombreados alternados, R, rótulos arriba o al pie del papel).

import { CircleCheck, CircleX } from 'lucide-react'
import { useId } from 'react'

import { ALTO_TIRA_MM } from '@/lib/tira'
import { cn } from '@/lib/utils'
import type { Tira } from '@/motor/latido'
import { msAMm, mvAMm } from '@/motor/papel'
import type { Marca, Zona } from '@/motor/retos'

/** Instantes donde una marca traza una línea vertical: la R, o los bordes de una zona sombreada. */
function lineasDe(marca: Marca): number[] {
  switch (marca.tipo) {
    case 'linea':
      return [marca.enMs]
    case 'sombreado':
    case 'ventana':
      return [marca.desdeMs, marca.hastaMs]
    case 'tramo':
    case 'rotulo':
      return []
  }
}

const ROTULO =
  'pequeno pointer-events-none rounded-sm bg-papel/90 font-medium whitespace-nowrap text-trazo'

/** El rótulo de una marca, arriba o al pie del papel; los de la evidencia llevan `data-evidencia`. */
function Rotulo({
  marca,
  porcentaje,
  evidencia,
}: {
  marca: Marca
  porcentaje: (ms: number) => string
  evidencia: boolean
}) {
  const datos = evidencia ? { 'data-evidencia': marca.tipo } : {}
  if (marca.tipo === 'tramo') {
    // Una caja del ancho del tramo: el rótulo se centra en ella y, si es omitible, se oculta
    // cuando la caja queda más angosta que él.
    return (
      <div
        className={cn(
          'pointer-events-none absolute flex justify-center',
          marca.abajo ? 'bottom-1' : 'top-1',
          marca.omitible && '@container',
        )}
        style={{
          left: porcentaje(marca.desdeMs),
          width: porcentaje(marca.hastaMs - marca.desdeMs),
        }}
        aria-hidden="true"
      >
        <span
          className={cn(
            ROTULO,
            'px-1 tabular-nums',
            // Omitible: fuera si no entra en su tramo, o en una tira angosta (el celular en
            // vertical), donde taparía el trazo.
            marca.omitible && '@max-[3.5rem]:hidden @max-[40rem]/tira:hidden',
          )}
          {...datos}
        >
          {marca.etiqueta}
        </span>
      </div>
    )
  }
  const desde = marca.tipo === 'linea' || marca.tipo === 'rotulo' ? marca.enMs : marca.desdeMs
  const hasta = marca.tipo === 'linea' || marca.tipo === 'rotulo' ? marca.enMs : marca.hastaMs
  return (
    <span
      className={cn(
        ROTULO,
        'absolute -translate-x-1/2',
        marca.tipo === 'rotulo' ? 'bottom-1 px-1 tabular-nums' : 'top-1 px-1.5',
        // En una tira angosta (el celular en vertical) las R de la evidencia taparían los picos:
        // queda la línea, sin el rótulo.
        evidencia && marca.tipo === 'linea' && '@max-[40rem]/tira:hidden',
      )}
      style={{ left: porcentaje((desde + hasta) / 2) }}
      aria-hidden="true"
      {...datos}
    >
      {marca.etiqueta}
    </span>
  )
}

export type EstadoZonas = {
  elegida: string | null
  correcta: string | null
}

/** Lo que un reto con zonas agrega a la tira; sin zonas, sólo el pulso. */
export type PropsZonas = {
  zonas?: readonly Zona[]
  estadoZonas?: EstadoZonas
  onZona?: (id: string) => void
  pulso?: boolean
}

type Props = {
  tira: Tira
  /** Nombre accesible del dibujo; no debe revelar la respuesta. */
  etiqueta: string
  marcas?: readonly Marca[]
  /** La prueba de la respuesta: se pasa sólo después de responder. */
  evidencia?: readonly Marca[]
  zonas?: readonly Zona[]
  estadoZonas?: EstadoZonas
  onZona?: (id: string) => void
  /** Milímetros de alto del papel; la línea de base queda a `baseMm` del borde inferior. */
  altoMm?: number
  baseMm?: number
  /** Píxeles por milímetro como máximo: evita que un latido solo se vuelva gigante. */
  maxPxPorMm?: number
  /** Latido animado al acertar (un pulso breve del trazo). */
  pulso?: boolean
}

export function TiraEcg({
  tira,
  etiqueta,
  marcas = [],
  evidencia = [],
  zonas = [],
  estadoZonas = { elegida: null, correcta: null },
  onZona,
  altoMm = ALTO_TIRA_MM,
  baseMm = 7,
  maxPxPorMm,
  pulso = false,
}: Props) {
  const anchoMm = msAMm(tira.duracionMs)
  const baseY = altoMm - baseMm
  const puntos = tira.muestras.map((mv, i) => {
    const x = msAMm(i * tira.pasoMs)
    const y = baseY - mvAMm(mv)
    return `${x.toFixed(3)},${y.toFixed(3)}`
  })
  const trazo = `M${puntos.join(' L')}`
  const porcentaje = (ms: number) => `${((ms / tira.duracionMs) * 100).toFixed(3)}%`
  // Único por instancia: la misma tira puede dibujarse dos veces a la vez (la pantalla y, encima, la
  // tira apaisada), y un id repetido haría que una tome el patrón de la otra.
  const idPatron = `papel-${useId().replace(/[^\w-]/g, '')}`

  return (
    <div
      className="@container/tira relative w-full rounded-lg border border-papel-linea-gruesa bg-papel"
      style={maxPxPorMm ? { maxWidth: `${anchoMm * maxPxPorMm}px` } : undefined}
    >
      <svg
        viewBox={`0 0 ${anchoMm} ${altoMm}`}
        className={cn('block h-auto w-full rounded-lg', pulso && 'tira-pulso')}
        role="img"
        aria-label={etiqueta}
      >
        <defs>
          <pattern id={idPatron} width="5" height="5" patternUnits="userSpaceOnUse">
            <path
              d="M1 0V5M2 0V5M3 0V5M4 0V5M0 1H5M0 2H5M0 3H5M0 4H5"
              className="stroke-papel-linea-fina"
              strokeWidth="0.6"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
            <path
              d="M0 0H5V5"
              className="stroke-papel-linea-gruesa"
              strokeWidth="1.1"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width={anchoMm} height={altoMm} fill={`url(#${idPatron})`} />
        {evidencia.map((marca, i) =>
          marca.tipo === 'tramo' ? (
            <rect
              key={`evidencia-${i}`}
              x={msAMm(marca.desdeMs)}
              y={0}
              width={msAMm(marca.hastaMs - marca.desdeMs)}
              height={altoMm}
              className={marca.alterno ? 'fill-trazo-resalte/10' : 'fill-trazo-resalte/25'}
            />
          ) : null,
        )}
        {marcas.map((marca, i) => {
          if (marca.tipo === 'sombreado' || marca.tipo === 'ventana') {
            return (
              <rect
                key={i}
                x={msAMm(marca.desdeMs)}
                y={0}
                width={msAMm(marca.hastaMs - marca.desdeMs)}
                height={altoMm}
                className={
                  marca.tipo === 'sombreado' ? 'fill-trazo-resalte/25' : 'fill-trazo-resalte/10'
                }
              />
            )
          }
          return null
        })}
        <path
          d={trazo}
          className="stroke-trazo"
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          fill="none"
        />
        {[...marcas, ...evidencia.filter((m) => m.tipo === 'linea')].map((marca, i) => {
          return lineasDe(marca).map((ms, j) => (
            <line
              key={`${i}-${j}`}
              x1={msAMm(ms)}
              x2={msAMm(ms)}
              y1={0}
              y2={altoMm}
              className="stroke-trazo-resalte"
              strokeWidth="2"
              strokeDasharray={marca.tipo === 'linea' ? undefined : '4 3'}
              vectorEffect="non-scaling-stroke"
            />
          ))
        })}
      </svg>

      {marcas.map((marca, i) => (
        <Rotulo key={i} marca={marca} porcentaje={porcentaje} evidencia={false} />
      ))}
      {evidencia.map((marca, i) => (
        <Rotulo key={`evidencia-${i}`} marca={marca} porcentaje={porcentaje} evidencia />
      ))}

      {zonas.length > 0 && (
        <div className="absolute inset-0" role="group" aria-label="Partes del latido para tocar">
          {zonas.map((zona) => {
            const elegida = estadoZonas.elegida === zona.id
            const resuelta = estadoZonas.elegida !== null
            const esCorrecta = estadoZonas.correcta === zona.id
            return (
              <button
                key={zona.id}
                type="button"
                className={cn(
                  'absolute inset-y-0 flex items-end justify-center rounded-md pb-1 transition-colors duration-(--duracion-breve) ease-(--curva) outline-none',
                  'hover:bg-trazo-resalte/15 focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  resuelta && esCorrecta && 'bg-exito/20',
                  resuelta && elegida && !esCorrecta && 'bg-peligro/20',
                  resuelta && 'cursor-default',
                )}
                style={{
                  left: porcentaje(zona.desdeMs),
                  width: porcentaje(zona.hastaMs - zona.desdeMs),
                }}
                aria-label={zona.etiqueta}
                aria-pressed={elegida}
                disabled={resuelta}
                onClick={() => onZona?.(zona.id)}
              >
                {resuelta && esCorrecta && (
                  <CircleCheck className="size-5 text-exito" aria-hidden="true" />
                )}
                {resuelta && elegida && !esCorrecta && (
                  <CircleX className="size-5 text-peligro" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

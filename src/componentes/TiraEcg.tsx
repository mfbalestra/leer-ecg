// El papel milimetrado con el trazado encima. Dibuja en milímetros reales (25 mm/s, 10 mm/mV) y
// escala con el ancho disponible; las marcas y las zonas para tocar van como HTML sobre el SVG,
// así sus textos no se achican con el papel y las zonas son botones de verdad.
//
// Uso:
//   <TiraEcg tira={tira} etiqueta="Tira de seis segundos" marcas={marcas} />
//   <TiraEcg tira={tira} etiqueta="Un latido" zonas={zonas} onZona={(id) => responder(id)} />
// Estados: zonas en reposo, con foco, elegida correcta, elegida incorrecta y deshabilitadas.

import { CircleCheck, CircleX } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Tira } from '@/motor/latido'
import { msAMm, mvAMm } from '@/motor/papel'
import type { Marca, Zona } from '@/motor/retos'

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
  zonas = [],
  estadoZonas = { elegida: null, correcta: null },
  onZona,
  altoMm = 24,
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
  const idPatron = `papel-${tira.id}`

  return (
    <div
      className="relative w-full rounded-lg border border-papel-linea-gruesa bg-papel"
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
        {marcas.map((marca, i) => {
          const lineas: number[] =
            marca.tipo === 'linea' ? [marca.enMs] : [marca.desdeMs, marca.hastaMs]
          return lineas.map((ms, j) => (
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

      {marcas.map((marca, i) => {
        const desde = marca.tipo === 'linea' ? marca.enMs : marca.desdeMs
        const hasta = marca.tipo === 'linea' ? marca.enMs : marca.hastaMs
        const centro = (desde + hasta) / 2
        return (
          <span
            key={i}
            className="pequeno pointer-events-none absolute top-1 -translate-x-1/2 rounded-sm bg-papel/90 px-1.5 font-medium text-trazo"
            style={{ left: porcentaje(centro) }}
            aria-hidden="true"
          >
            {marca.etiqueta}
          </span>
        )
      })}

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

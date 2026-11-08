// Un pedazo de papel milimetrado vacío con una parte resaltada: un cuadrado chico, uno grande o un
// segundo entero. Sirve para los retos del nivel 1, donde todavía no hay trazado.
//
// Uso: <Papel resaltar="cuadrado-grande" />
// Estados: resaltar en 'cuadrado-chico' | 'cuadrado-grande' | 'segundo' | 'ninguno'.

import type { ResaltePapel } from '@/motor/retos'

const ANCHO_MM = 50
const ALTO_MM = 20

const LEYENDA: Record<ResaltePapel, string> = {
  'cuadrado-chico': 'Resaltado: un cuadrado chico (1 mm de lado).',
  'cuadrado-grande': 'Resaltado: un cuadrado grande (5 mm de lado, cinco chicos).',
  segundo: 'Resaltado: un segundo de tira (25 mm, cinco cuadrados grandes).',
  ninguno: 'Papel milimetrado estándar.',
}

type Caja = { x: number; y: number; w: number; h: number }

const RESALTE: Record<ResaltePapel, Caja | null> = {
  'cuadrado-chico': { x: 22, y: 7, w: 1, h: 1 },
  'cuadrado-grande': { x: 20, y: 5, w: 5, h: 5 },
  segundo: { x: 10, y: 0, w: 25, h: ALTO_MM },
  ninguno: null,
}

export function Papel({ resaltar }: { resaltar: ResaltePapel }) {
  const resalte = RESALTE[resaltar]
  return (
    <figure className="m-0 w-full">
      <div className="rounded-lg border border-papel-linea-gruesa bg-papel">
        <svg
          viewBox={`0 0 ${ANCHO_MM} ${ALTO_MM}`}
          className="block h-auto w-full rounded-lg"
          role="img"
          aria-label={LEYENDA[resaltar]}
        >
          <defs>
            <pattern id="papel-vacio" width="5" height="5" patternUnits="userSpaceOnUse">
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
          <rect width={ANCHO_MM} height={ALTO_MM} fill="url(#papel-vacio)" />
          {resalte && (
            <rect
              x={resalte.x}
              y={resalte.y}
              width={resalte.w}
              height={resalte.h}
              className="fill-trazo-resalte/30 stroke-trazo-resalte"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
      </div>
      <figcaption className="pequeno mt-2 text-texto-tenue">{LEYENDA[resaltar]}</figcaption>
    </figure>
  )
}

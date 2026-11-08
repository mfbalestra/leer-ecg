// Los retos: cada uno se genera con azar a partir de parámetros, y su respuesta correcta sale de esos
// mismos parámetros, nunca de lo dibujado. Un error vuelve a aparecer con otros números.

import type { Azar } from './azar.ts'
import { latidosPorMinuto, milisegundos, numero, segundos } from './formato.ts'
import {
  LATIDO_NORMAL,
  contarQrs,
  generarTira,
  latidosVisibles,
  regionesLatido,
  ritmoTieneP,
  type LatidoEnTira,
  type NombreRegion,
  type ParametrosLatido,
  type Ritmo,
  type Tira,
} from './latido.ts'
import {
  CUADRADOS_GRANDES_POR_MINUTO,
  MS_POR_CUADRADO_CHICO,
  MS_POR_CUADRADO_GRANDE,
  SECUENCIA_300,
  VELOCIDAD_MM_POR_S,
  cuadradosChicos,
  frecuenciaPorConteo,
  frecuenciaPorCuadradosGrandes,
} from './papel.ts'
import { NORMAL, juzgarFrecuencia, juzgarPr, juzgarQrs } from './valores.ts'

export type NivelId = 'papel' | 'latido' | 'frecuencia' | 'ritmo' | 'lectura'

export type Nivel = {
  id: NivelId
  numero: number
  titulo: string
  descripcion: string
  /** Aciertos para completar el nivel. */
  meta: number
}

export const NIVELES: readonly Nivel[] = [
  {
    id: 'papel',
    numero: 1,
    titulo: 'El papel',
    descripcion: 'Qué vale cada cuadradito: tiempo y voltaje.',
    meta: 7,
  },
  {
    id: 'latido',
    numero: 2,
    titulo: 'Un latido',
    descripcion: 'P, QRS, T y lo que hay entre medio.',
    meta: 8,
  },
  {
    id: 'frecuencia',
    numero: 3,
    titulo: 'Frecuencia',
    descripcion: 'La regla del 300 y el conteo en 6 segundos.',
    meta: 8,
  },
  {
    id: 'ritmo',
    numero: 4,
    titulo: 'Ritmo e intervalos',
    descripcion: '¿Regular? ¿Hay P? ¿El PR y el QRS son normales?',
    meta: 10,
  },
  {
    id: 'lectura',
    numero: 5,
    titulo: 'Lectura completa',
    descripcion: 'Una tira al azar y la lectura de punta a punta, con reloj.',
    meta: 12,
  },
]

export function nivelPorId(id: NivelId): Nivel {
  const nivel = NIVELES.find((n) => n.id === id)
  if (!nivel) throw new Error(`Nivel desconocido: ${id}`)
  return nivel
}

export type TipoReto =
  | 'papel-chico-tiempo'
  | 'papel-grande-tiempo'
  | 'papel-chicos-en-grande'
  | 'papel-grandes-en-segundo'
  | 'papel-chico-voltaje'
  | 'papel-velocidad'
  | 'papel-grandes-en-minuto'
  | 'latido-tocar'
  | 'latido-nombrar'
  | 'latido-significado'
  | 'frecuencia-contar-grandes'
  | 'frecuencia-regla-300'
  | 'frecuencia-contar-qrs'
  | 'frecuencia-conteo-a-lpm'
  | 'frecuencia-juzgar'
  | 'ritmo-regular'
  | 'ritmo-p'
  | 'ritmo-medir-pr'
  | 'ritmo-juzgar-pr'
  | 'ritmo-medir-qrs'
  | 'ritmo-juzgar-qrs'

export type TipoPapel = Extract<TipoReto, `papel-${string}`>
export type TipoLatido = Extract<TipoReto, `latido-${string}`>
export type TipoFrecuencia = Extract<TipoReto, `frecuencia-${string}`>
export type TipoRitmoTira = 'ritmo-regular' | 'ritmo-p'
export type TipoRitmoIntervalo =
  'ritmo-medir-pr' | 'ritmo-juzgar-pr' | 'ritmo-medir-qrs' | 'ritmo-juzgar-qrs'

export function esTipoPapel(tipo: TipoReto): tipo is TipoPapel {
  return tipo.startsWith('papel-')
}
export function esTipoLatido(tipo: TipoReto): tipo is TipoLatido {
  return tipo.startsWith('latido-')
}
export function esTipoFrecuencia(tipo: TipoReto): tipo is TipoFrecuencia {
  return tipo.startsWith('frecuencia-')
}
export function esTipoRitmoTira(tipo: TipoReto): tipo is TipoRitmoTira {
  return tipo === 'ritmo-regular' || tipo === 'ritmo-p'
}

export const TIPOS_POR_NIVEL: Record<NivelId, readonly TipoReto[]> = {
  papel: [
    'papel-chico-tiempo',
    'papel-grande-tiempo',
    'papel-chicos-en-grande',
    'papel-grandes-en-segundo',
    'papel-chico-voltaje',
    'papel-velocidad',
    'papel-grandes-en-minuto',
  ],
  latido: ['latido-tocar', 'latido-nombrar', 'latido-significado'],
  frecuencia: [
    'frecuencia-contar-grandes',
    'frecuencia-regla-300',
    'frecuencia-contar-qrs',
    'frecuencia-conteo-a-lpm',
    'frecuencia-juzgar',
  ],
  ritmo: [
    'ritmo-regular',
    'ritmo-p',
    'ritmo-medir-pr',
    'ritmo-juzgar-pr',
    'ritmo-medir-qrs',
    'ritmo-juzgar-qrs',
  ],
  lectura: [
    'ritmo-regular',
    'frecuencia-regla-300',
    'frecuencia-contar-qrs',
    'ritmo-p',
    'ritmo-juzgar-pr',
    'ritmo-juzgar-qrs',
  ],
}

export type Opcion = { id: string; etiqueta: string }

export type Marca =
  | { tipo: 'sombreado'; desdeMs: number; hastaMs: number; etiqueta: string }
  | { tipo: 'linea'; enMs: number; etiqueta: string }
  | { tipo: 'ventana'; desdeMs: number; hastaMs: number; etiqueta: string }

export type Zona = { id: string; etiqueta: string; desdeMs: number; hastaMs: number }

export type Respuesta =
  | { modo: 'opciones'; opciones: Opcion[]; correcta: string }
  | { modo: 'zona'; zonas: Zona[]; correcta: string }
  | { modo: 'conteo'; correcta: number; minimo: number; maximo: number; unidad: string }

export type ResaltePapel = 'cuadrado-chico' | 'cuadrado-grande' | 'segundo' | 'ninguno'

export type Vista =
  | { tipo: 'papel'; resaltar: ResaltePapel }
  | { tipo: 'latido'; tira: Tira; latido: LatidoEnTira; desdeMs: number; hastaMs: number }
  | { tipo: 'tira'; tira: Tira }
  | { tipo: 'texto' }

export type Reto = {
  id: string
  nivel: NivelId
  tipo: TipoReto
  enunciado: string
  vista: Vista
  marcas: Marca[]
  respuesta: Respuesta
  /** Lo que se dice al acertar: la regla en una línea. */
  acierto: string
  /** Lo que se dice al errar: la respuesta correcta y la regla. */
  error: string
}

export type RespuestaDada = string | number

export function esCorrecta(reto: Reto, dada: RespuestaDada): boolean {
  return dada === reto.respuesta.correcta
}

// ---------------------------------------------------------------------------------------------
// Ayudas

const NOMBRE_REGION: Record<NombreRegion, string> = {
  p: 'onda P',
  'pr-segmento': 'segmento PR',
  qrs: 'complejo QRS',
  st: 'segmento ST',
  t: 'onda T',
  'pr-intervalo': 'intervalo PR',
  qt: 'intervalo QT',
}

/** Artículo que acompaña a cada región: «la onda P», «el segmento ST». */
const ARTICULO_REGION: Record<NombreRegion, string> = {
  p: 'la',
  'pr-segmento': 'el',
  qrs: 'el',
  st: 'el',
  t: 'la',
  'pr-intervalo': 'el',
  qt: 'el',
}

const SIGNIFICADO_REGION: Record<NombreRegion, string> = {
  p: 'la despolarización de las aurículas',
  'pr-segmento': 'el paso del impulso por el nodo AV, antes de los ventrículos',
  qrs: 'la despolarización de los ventrículos',
  st: 'el tiempo entre que los ventrículos se despolarizan y se repolarizan',
  t: 'la repolarización de los ventrículos',
  'pr-intervalo': 'desde que arrancan las aurículas hasta que arrancan los ventrículos',
  qt: 'toda la actividad eléctrica de los ventrículos, de punta a punta',
}

function conOpciones(
  base: Omit<Reto, 'respuesta'>,
  azar: Azar,
  lista: readonly Opcion[],
  correcta: string,
): Reto {
  return { ...base, respuesta: { modo: 'opciones', opciones: azar.mezclar(lista), correcta } }
}

function latidoSolo(azar: Azar, parametros: ParametrosLatido): Extract<Vista, { tipo: 'latido' }> {
  const inicioMs = 60
  const tira = generarTira({
    duracionMs: inicioMs + parametros.prMs + parametros.qtMs + 80,
    parametros: { ...parametros, frecuencia: 40 },
    ritmo: 'regular',
    azar,
    inicioMs,
  })
  const latido = tira.latidos[0]
  if (!latido) throw new Error('La tira de un latido no tiene latido')
  return { tipo: 'latido', tira, latido, desdeMs: 0, hastaMs: tira.duracionMs }
}

function tiraDe(
  azar: Azar,
  duracionMs: number,
  ritmo: Ritmo,
  parametros: Partial<ParametrosLatido> = {},
): Tira {
  return generarTira({ duracionMs, parametros: { ...LATIDO_NORMAL, ...parametros }, ritmo, azar })
}

// ---------------------------------------------------------------------------------------------
// Nivel 1: el papel

const TIEMPOS: readonly Opcion[] = [
  { id: '40', etiqueta: segundos(0.04) },
  { id: '200', etiqueta: segundos(0.2) },
  { id: '1000', etiqueta: segundos(1) },
  { id: '100', etiqueta: segundos(0.1) },
]

function retoPapel(id: string, tipo: TipoPapel, azar: Azar): Reto {
  const base = { id, nivel: 'papel' as const, tipo, marcas: [] as Marca[] }
  switch (tipo) {
    case 'papel-chico-tiempo':
      return conOpciones(
        {
          ...base,
          enunciado: 'A 25 mm/s, ¿cuánto tiempo mide un cuadrado chico de ancho?',
          vista: { tipo: 'papel', resaltar: 'cuadrado-chico' },
          acierto: `Un cuadrado chico de ancho mide ${segundos(MS_POR_CUADRADO_CHICO / 1000)}: ${milisegundos(MS_POR_CUADRADO_CHICO)}.`,
          error: `Un cuadrado chico de ancho mide ${segundos(MS_POR_CUADRADO_CHICO / 1000)} (${milisegundos(MS_POR_CUADRADO_CHICO)}): el papel corre a ${VELOCIDAD_MM_POR_S} mm por segundo.`,
        },
        azar,
        TIEMPOS,
        '40',
      )
    case 'papel-grande-tiempo':
      return conOpciones(
        {
          ...base,
          enunciado: 'A 25 mm/s, ¿cuánto tiempo mide un cuadrado grande de ancho?',
          vista: { tipo: 'papel', resaltar: 'cuadrado-grande' },
          acierto: `Un cuadrado grande mide ${segundos(MS_POR_CUADRADO_GRANDE / 1000)}: cinco chicos de ${milisegundos(MS_POR_CUADRADO_CHICO)}.`,
          error: `Un cuadrado grande mide ${segundos(MS_POR_CUADRADO_GRANDE / 1000)} (${milisegundos(MS_POR_CUADRADO_GRANDE)}): son cinco chicos de ${milisegundos(MS_POR_CUADRADO_CHICO)}.`,
        },
        azar,
        TIEMPOS,
        '200',
      )
    case 'papel-chicos-en-grande':
      return conOpciones(
        {
          ...base,
          enunciado: '¿Cuántos cuadrados chicos entran a lo ancho en un cuadrado grande?',
          vista: { tipo: 'papel', resaltar: 'cuadrado-grande' },
          acierto: 'Cinco: el cuadrado grande mide 5 mm y cada chico, 1 mm.',
          error: 'Son cinco: el cuadrado grande mide 5 mm y cada chico, 1 mm.',
        },
        azar,
        [
          { id: '5', etiqueta: '5' },
          { id: '4', etiqueta: '4' },
          { id: '10', etiqueta: '10' },
          { id: '25', etiqueta: '25' },
        ],
        '5',
      )
    case 'papel-grandes-en-segundo':
      return conOpciones(
        {
          ...base,
          enunciado: '¿Cuántos cuadrados grandes hay en un segundo?',
          vista: { tipo: 'papel', resaltar: 'segundo' },
          acierto: `Cinco: ${segundos(0.2)} por cuadrado grande, cinco cuadrados por segundo.`,
          error: `Son cinco: cada cuadrado grande mide ${segundos(0.2)}, y cinco hacen un segundo.`,
        },
        azar,
        [
          { id: '5', etiqueta: '5' },
          { id: '25', etiqueta: '25' },
          { id: '10', etiqueta: '10' },
          { id: '4', etiqueta: '4' },
        ],
        '5',
      )
    case 'papel-chico-voltaje':
      return conOpciones(
        {
          ...base,
          enunciado: 'Con ganancia de 10 mm/mV, ¿cuánto voltaje mide un cuadrado chico de alto?',
          vista: { tipo: 'papel', resaltar: 'cuadrado-chico' },
          acierto: `${numero(0.1, 1)} mV: diez cuadrados chicos de alto son un milivoltio.`,
          error: `Es ${numero(0.1, 1)} mV: con 10 mm por milivoltio, cada milímetro de alto vale ${numero(0.1, 1)} mV.`,
        },
        azar,
        [
          { id: '0.1', etiqueta: `${numero(0.1, 1)} mV` },
          { id: '1', etiqueta: `${numero(1, 1)} mV` },
          { id: '0.5', etiqueta: `${numero(0.5, 1)} mV` },
          { id: '0.04', etiqueta: `${numero(0.04, 2)} mV` },
        ],
        '0.1',
      )
    case 'papel-velocidad':
      return conOpciones(
        {
          ...base,
          enunciado: '¿A qué velocidad corre el papel en un electrocardiograma estándar?',
          vista: { tipo: 'papel', resaltar: 'ninguno' },
          acierto: '25 mm por segundo: por eso un cuadrado chico son 40 ms.',
          error: 'Corre a 25 mm por segundo; de ahí salen los 40 ms del cuadrado chico.',
        },
        azar,
        [
          { id: '25', etiqueta: '25 mm/s' },
          { id: '50', etiqueta: '50 mm/s' },
          { id: '10', etiqueta: '10 mm/s' },
          { id: '100', etiqueta: '100 mm/s' },
        ],
        '25',
      )
    case 'papel-grandes-en-minuto':
      return conOpciones(
        {
          ...base,
          enunciado: '¿Cuántos cuadrados grandes entran en un minuto de tira?',
          vista: { tipo: 'papel', resaltar: 'segundo' },
          acierto: `${CUADRADOS_GRANDES_POR_MINUTO}: cinco por segundo, sesenta segundos. De acá sale la regla del 300.`,
          error: `Son ${CUADRADOS_GRANDES_POR_MINUTO}: cinco por segundo por sesenta segundos. Ese número es la regla del 300.`,
        },
        azar,
        [
          { id: '300', etiqueta: '300' },
          { id: '1500', etiqueta: '1.500' },
          { id: '60', etiqueta: '60' },
          { id: '150', etiqueta: '150' },
        ],
        '300',
      )
  }
}

// ---------------------------------------------------------------------------------------------
// Nivel 2: un latido

const REGIONES_TOCABLES: readonly NombreRegion[] = ['p', 'qrs', 'st', 't']
const REGIONES_NOMBRABLES: readonly NombreRegion[] = ['p', 'pr-segmento', 'qrs', 'st', 't']

/**
 * Zonas para tocar. Cada una se ensancha hacia la línea de base vecina (que no es zona) para que en
 * un celular mida al menos 44 px: la P toma 50 ms antes y 30 ms del segmento PR, el QRS 40 ms del
 * segmento PR, y la T 40 ms después. Con el PR normal (segmento de 70 ms) no se superponen.
 */
function zonasDe(latido: LatidoEnTira, nombres: readonly NombreRegion[]): Zona[] {
  const regiones = regionesLatido(latido)
  const margen: Record<NombreRegion, [number, number]> = {
    p: [-50, 30],
    'pr-segmento': [0, 0],
    qrs: [-40, 0],
    st: [0, 0],
    t: [0, 40],
    'pr-intervalo': [0, 0],
    qt: [0, 0],
  }
  return nombres.map((nombre) => {
    const r = regiones[nombre]
    const [antes, despues] = margen[nombre]
    return {
      id: nombre,
      etiqueta: NOMBRE_REGION[nombre],
      desdeMs: r.desdeMs + antes,
      hastaMs: r.hastaMs + despues,
    }
  })
}

function retoLatido(id: string, tipo: TipoLatido, azar: Azar): Reto {
  const vista = latidoSolo(azar, LATIDO_NORMAL)
  const base = { id, nivel: 'latido' as const, tipo, vista }
  switch (tipo) {
    case 'latido-tocar': {
      const pedida = azar.elegir(REGIONES_TOCABLES)
      return {
        ...base,
        enunciado: `Tocá ${ARTICULO_REGION[pedida]} ${NOMBRE_REGION[pedida]}.`,
        marcas: [],
        respuesta: {
          modo: 'zona',
          zonas: zonasDe(vista.latido, REGIONES_TOCABLES),
          correcta: pedida,
        },
        acierto: `Esa es: ${NOMBRE_REGION[pedida]}, ${SIGNIFICADO_REGION[pedida]}.`,
        error: `Quedó marcada la respuesta: ${ARTICULO_REGION[pedida]} ${NOMBRE_REGION[pedida]}, ${SIGNIFICADO_REGION[pedida]}.`,
      }
    }
    case 'latido-nombrar': {
      const marcada = azar.elegir(REGIONES_NOMBRABLES)
      const r = regionesLatido(vista.latido)[marcada]
      return conOpciones(
        {
          ...base,
          enunciado: '¿Qué es la parte sombreada?',
          marcas: [{ tipo: 'sombreado', desdeMs: r.desdeMs, hastaMs: r.hastaMs, etiqueta: '?' }],
          acierto: `${NOMBRE_REGION[marcada]}: ${SIGNIFICADO_REGION[marcada]}.`,
          error: `Es ${NOMBRE_REGION[marcada]}: ${SIGNIFICADO_REGION[marcada]}.`,
        },
        azar,
        REGIONES_NOMBRABLES.map((n) => ({ id: n, etiqueta: NOMBRE_REGION[n] })),
        marcada,
      )
    }
    case 'latido-significado': {
      const pedida = azar.elegir(REGIONES_NOMBRABLES)
      const r = regionesLatido(vista.latido)[pedida]
      return conOpciones(
        {
          ...base,
          enunciado: `¿Qué representa ${ARTICULO_REGION[pedida]} ${NOMBRE_REGION[pedida]}?`,
          marcas: [
            {
              tipo: 'sombreado',
              desdeMs: r.desdeMs,
              hastaMs: r.hastaMs,
              etiqueta: NOMBRE_REGION[pedida],
            },
          ],
          acierto: `${NOMBRE_REGION[pedida]}: ${SIGNIFICADO_REGION[pedida]}.`,
          error: `${NOMBRE_REGION[pedida]} representa ${SIGNIFICADO_REGION[pedida]}.`,
        },
        azar,
        REGIONES_NOMBRABLES.map((n) => ({ id: n, etiqueta: SIGNIFICADO_REGION[n] })),
        pedida,
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Nivel 3: frecuencia

const OPCIONES_300: readonly Opcion[] = SECUENCIA_300.map((lpm) => ({
  id: String(lpm),
  etiqueta: latidosPorMinuto(lpm),
}))

/** Una tira regular con un número entero de cuadrados grandes entre dos R, y las dos R marcadas. */
function tiraReglaDel300(azar: Azar): {
  tira: Tira
  cuadrados: number
  lpm: number
  marcas: Marca[]
} {
  const cuadrados = azar.entero(2, 6)
  const lpm = frecuenciaPorCuadradosGrandes(cuadrados)
  const tira = tiraDe(azar, 4000, 'regular', { frecuencia: lpm })
  const [primero, segundo] = latidosVisibles(tira)
  if (!primero || !segundo) throw new Error('La tira de la regla del 300 necesita dos R visibles')
  const marcas: Marca[] = [
    { tipo: 'linea', enMs: primero.rMs, etiqueta: 'R' },
    { tipo: 'linea', enMs: segundo.rMs, etiqueta: 'R' },
  ]
  return { tira, cuadrados, lpm, marcas }
}

/** Contar los QRS en los 6 segundos de una tira: la frecuencia aproximada es el conteo × 10. */
function retoContarQrs(
  base: { id: string; nivel: NivelId; tipo: TipoReto },
  tira: Tira,
  enunciado: string,
): Reto {
  const contados = contarQrs(tira, 0, 6000)
  const lpm = frecuenciaPorConteo(contados, 6)
  return {
    ...base,
    enunciado,
    vista: { tipo: 'tira', tira },
    marcas: [{ tipo: 'ventana', desdeMs: 0, hastaMs: 6000, etiqueta: '6 segundos' }],
    respuesta: { modo: 'conteo', correcta: contados, minimo: 0, maximo: 20, unidad: 'QRS' },
    acierto: `${contados} QRS en 6 segundos × 10 = ${latidosPorMinuto(lpm)}, aproximadamente.`,
    error: `Son ${contados} QRS: contá los picos altos dentro de la ventana. ${contados} × 10 = ${latidosPorMinuto(lpm)}.`,
  }
}

function retoFrecuencia(
  id: string,
  tipo: TipoFrecuencia,
  azar: Azar,
  nivel: NivelId = 'frecuencia',
): Reto {
  const base = { id, nivel, tipo }
  switch (tipo) {
    case 'frecuencia-contar-grandes': {
      const { tira, cuadrados, lpm, marcas } = tiraReglaDel300(azar)
      return {
        ...base,
        enunciado: '¿Cuántos cuadrados grandes hay entre las dos R marcadas?',
        vista: { tipo: 'tira', tira },
        marcas,
        respuesta: {
          modo: 'conteo',
          correcta: cuadrados,
          minimo: 1,
          maximo: 8,
          unidad: 'cuadrados grandes',
        },
        acierto: `${cuadrados} cuadrados grandes: ${CUADRADOS_GRANDES_POR_MINUTO} ÷ ${cuadrados} = ${latidosPorMinuto(lpm)}.`,
        error: `Hay ${cuadrados}: contá las líneas gruesas entre una R y la siguiente. ${CUADRADOS_GRANDES_POR_MINUTO} ÷ ${cuadrados} = ${latidosPorMinuto(lpm)}.`,
      }
    }
    case 'frecuencia-regla-300': {
      const { tira, cuadrados, lpm, marcas } = tiraReglaDel300(azar)
      return conOpciones(
        {
          ...base,
          enunciado: `Entre las dos R hay ${cuadrados} cuadrados grandes. ¿Qué frecuencia es?`,
          vista: { tipo: 'tira', tira },
          marcas,
          acierto: `${CUADRADOS_GRANDES_POR_MINUTO} ÷ ${cuadrados} = ${latidosPorMinuto(lpm)}. La secuencia: ${SECUENCIA_300.join(', ')}.`,
          error: `${CUADRADOS_GRANDES_POR_MINUTO} ÷ ${cuadrados} = ${latidosPorMinuto(lpm)}. Memorizá la secuencia ${SECUENCIA_300.join(', ')}: un número por cuadrado grande.`,
        },
        azar,
        OPCIONES_300,
        String(lpm),
      )
    }
    case 'frecuencia-contar-qrs': {
      const ritmo = azar.elegir<Ritmo>(['regular', 'sinusal-irregular', 'irregular-sin-p'])
      const tira = tiraDe(azar, 6000, ritmo, { frecuencia: azar.entero(45, 140) })
      return retoContarQrs(base, tira, 'Contá los complejos QRS que caen dentro de los 6 segundos.')
    }
    case 'frecuencia-conteo-a-lpm': {
      const contados = azar.entero(3, 14)
      const lpm = frecuenciaPorConteo(contados, 6)
      return conOpciones(
        {
          ...base,
          enunciado: `Contaste ${contados} QRS en 6 segundos. ¿Frecuencia aproximada?`,
          vista: { tipo: 'texto' },
          marcas: [],
          acierto: `${contados} × 10 = ${latidosPorMinuto(lpm)}: seis segundos entran diez veces en un minuto.`,
          error: `${contados} × 10 = ${latidosPorMinuto(lpm)}: seis segundos entran diez veces en un minuto, así que se multiplica por 10.`,
        },
        azar,
        [
          { id: String(lpm), etiqueta: latidosPorMinuto(lpm) },
          { id: String(contados * 6), etiqueta: latidosPorMinuto(contados * 6) },
          { id: String(contados * 5), etiqueta: latidosPorMinuto(contados * 5) },
          { id: String(contados * 20), etiqueta: latidosPorMinuto(contados * 20) },
        ],
        String(lpm),
      )
    }
    case 'frecuencia-juzgar': {
      const lpm = azar.elegir([38, 45, 52, 58, 60, 64, 72, 85, 96, 100, 104, 118, 135, 150])
      const juicio = juzgarFrecuencia(lpm)
      return conOpciones(
        {
          ...base,
          enunciado: `Frecuencia de ${latidosPorMinuto(lpm)}. ¿Cómo se llama?`,
          vista: { tipo: 'texto' },
          marcas: [],
          acierto: `${latidosPorMinuto(lpm)} es ${juicio}: normal entre ${NORMAL.frecuencia.minLpm} y ${NORMAL.frecuencia.maxLpm} lpm.`,
          error: `${latidosPorMinuto(lpm)} es ${juicio}: menos de ${NORMAL.frecuencia.minLpm} es bradicardia, más de ${NORMAL.frecuencia.maxLpm} es taquicardia.`,
        },
        azar,
        [
          { id: 'bradicardia', etiqueta: 'Bradicardia' },
          { id: 'normal', etiqueta: 'Normal' },
          { id: 'taquicardia', etiqueta: 'Taquicardia' },
        ],
        juicio,
      )
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Nivel 4: ritmo e intervalos

const PR_POSIBLES = [120, 160, 200, 240, 280] as const
const QRS_POSIBLES = [80, 120, 160] as const
const QRS_JUZGABLES = [80, 90, 100, 120, 140, 160] as const

function prMarcado(azar: Azar, prMs: number, qrsMs = LATIDO_NORMAL.qrsMs) {
  const vista = latidoSolo(azar, { ...LATIDO_NORMAL, prMs, qrsMs })
  const r = regionesLatido(vista.latido)['pr-intervalo']
  return { vista, region: r }
}

/** QT que deja a la T su ancho entero aunque el QRS sea ancho. */
function qtPara(qrsMs: number): number {
  return Math.max(LATIDO_NORMAL.qtMs, qrsMs + 260)
}

function qrsMarcado(azar: Azar, qrsMs: number) {
  const vista = latidoSolo(azar, { ...LATIDO_NORMAL, qrsMs, qtMs: qtPara(qrsMs) })
  const r = regionesLatido(vista.latido).qrs
  return { vista, region: r }
}

function retoRitmoTira(
  id: string,
  tipo: TipoRitmoTira,
  azar: Azar,
  nivel: NivelId,
  tiraDada?: Tira,
): Reto {
  const base = { id, nivel, tipo, marcas: [] as Marca[] }
  if (tipo === 'ritmo-regular') {
    const tira =
      tiraDada ??
      tiraDe(
        azar,
        6000,
        azar.elegir<Ritmo>(['regular', 'regular', 'sinusal-irregular', 'irregular-sin-p']),
        { frecuencia: azar.entero(55, 110) },
      )
    const esRegular = tira.ritmo === 'regular'
    return conOpciones(
      {
        ...base,
        enunciado: '¿El ritmo es regular o irregular?',
        vista: { tipo: 'tira', tira },
        acierto: esRegular
          ? 'Regular: la distancia entre una R y la siguiente se repite igual.'
          : 'Irregular: la distancia entre las R cambia de un latido a otro.',
        error: esRegular
          ? 'Es regular: medí de una R a la siguiente con el borde de un papel y compará; se repite igual.'
          : 'Es irregular: medí de una R a la siguiente y compará con el siguiente par; la distancia cambia.',
      },
      azar,
      [
        { id: 'regular', etiqueta: 'Regular' },
        { id: 'irregular', etiqueta: 'Irregular' },
      ],
      esRegular ? 'regular' : 'irregular',
    )
  }
  const tira =
    tiraDada ??
    tiraDe(
      azar,
      6000,
      azar.elegir<Ritmo>(['regular', 'sinusal-irregular', 'irregular-sin-p', 'irregular-sin-p']),
      { frecuencia: azar.entero(55, 110) },
    )
  const hayP = ritmoTieneP(tira.ritmo)
  return conOpciones(
    {
      ...base,
      enunciado: '¿Hay una onda P antes de cada QRS?',
      vista: { tipo: 'tira', tira },
      acierto: hayP
        ? 'Sí: antes de cada QRS hay una P chiquita y redondeada.'
        : 'No: la línea de base ondula y no hay una P clara antes de los QRS.',
      error: hayP
        ? 'Sí hay: mirá justo antes de cada pico alto, la lomita chica y redondeada es la P.'
        : 'No hay: la línea de base ondula sin una P clara antes de cada QRS.',
    },
    azar,
    [
      { id: 'si', etiqueta: 'Sí, antes de cada QRS' },
      { id: 'no', etiqueta: 'No' },
    ],
    hayP ? 'si' : 'no',
  )
}

type BaseIntervalo = { id: string; nivel: NivelId; tipo: TipoRitmoIntervalo }

/** ¿El PR es normal o largo? Con la medida en el enunciado, o contando los cuadrados sobre el latido. */
function retoJuzgarPr(
  base: BaseIntervalo,
  azar: Azar,
  prMs: number,
  valorEnEnunciado: boolean,
): Reto {
  const { vista, region } = prMarcado(azar, prMs)
  const juicio = juzgarPr(prMs)
  const chicos = Math.round(cuadradosChicos(prMs))
  const medida = valorEnEnunciado
    ? milisegundos(prMs)
    : `${chicos} cuadrados chicos × ${milisegundos(MS_POR_CUADRADO_CHICO)} = ${milisegundos(prMs)}`
  return conOpciones(
    {
      ...base,
      enunciado: valorEnEnunciado
        ? `El PR mide ${milisegundos(prMs)}. ¿Es normal?`
        : '¿El PR sombreado es normal o largo? Contá los cuadrados chicos.',
      vista,
      marcas: [
        {
          tipo: 'sombreado',
          desdeMs: region.desdeMs,
          hastaMs: region.hastaMs,
          etiqueta: valorEnEnunciado ? `PR ${milisegundos(prMs)}` : 'PR',
        },
      ],
      acierto: `${medida}: ${juicio}. El PR normal va de ${milisegundos(NORMAL.pr.minMs)} a ${milisegundos(NORMAL.pr.maxMs)} (3 a 5 cuadrados chicos).`,
      error: `${medida}: ${juicio}. Normal entre ${milisegundos(NORMAL.pr.minMs)} y ${milisegundos(NORMAL.pr.maxMs)}; más largo es un bloqueo AV de primer grado.`,
    },
    azar,
    [
      { id: 'normal', etiqueta: 'Normal' },
      { id: 'largo', etiqueta: 'Largo' },
    ],
    juicio,
  )
}

/** ¿El QRS es angosto o ancho? Con la medida en el enunciado, o contando los cuadrados sobre el latido. */
function retoJuzgarQrs(
  base: BaseIntervalo,
  azar: Azar,
  qrsMs: number,
  valorEnEnunciado: boolean,
): Reto {
  const { vista, region } = qrsMarcado(azar, qrsMs)
  const juicio = juzgarQrs(qrsMs)
  const medida = valorEnEnunciado
    ? milisegundos(qrsMs)
    : `${numero(cuadradosChicos(qrsMs), 1)} cuadrados chicos × ${milisegundos(MS_POR_CUADRADO_CHICO)} = ${milisegundos(qrsMs)}`
  return conOpciones(
    {
      ...base,
      enunciado: valorEnEnunciado
        ? `El QRS mide ${milisegundos(qrsMs)}. ¿Angosto o ancho?`
        : '¿El QRS sombreado es angosto o ancho? Contá los cuadrados chicos.',
      vista,
      marcas: [
        {
          tipo: 'sombreado',
          desdeMs: region.desdeMs,
          hastaMs: region.hastaMs,
          etiqueta: valorEnEnunciado ? `QRS ${milisegundos(qrsMs)}` : 'QRS',
        },
      ],
      acierto: `${medida}: ${juicio}. Hasta ${milisegundos(NORMAL.qrs.maxMs)} es angosto; más de ${milisegundos(NORMAL.qrs.bloqueoMs)} hace pensar en un bloqueo de rama.`,
      error: `${medida}: ${juicio}. Angosto hasta ${milisegundos(NORMAL.qrs.maxMs)} (dos cuadrados chicos y medio); más que eso, ancho.`,
    },
    azar,
    [
      { id: 'angosto', etiqueta: 'Angosto (normal)' },
      { id: 'ancho', etiqueta: 'Ancho' },
    ],
    juicio,
  )
}

type OpcionesIntervalo = {
  prMs?: number
  qrsMs?: number
  /** Si el enunciado dice la medida. Sin ella, la persona cuenta los cuadrados antes de juzgar. */
  valorEnEnunciado?: boolean
}

function retoRitmoIntervalo(
  id: string,
  tipo: TipoRitmoIntervalo,
  azar: Azar,
  nivel: NivelId,
  dados: OpcionesIntervalo = {},
): Reto {
  const base = { id, nivel, tipo }
  const { prMs: prDado, qrsMs: qrsDado, valorEnEnunciado = true } = dados
  switch (tipo) {
    case 'ritmo-medir-pr': {
      const prMs = prDado ?? azar.elegir(PR_POSIBLES)
      const { vista, region } = prMarcado(azar, prMs)
      const chicos = Math.round(cuadradosChicos(prMs))
      return {
        ...base,
        enunciado: '¿Cuántos cuadrados chicos mide el intervalo PR sombreado?',
        vista,
        marcas: [
          { tipo: 'sombreado', desdeMs: region.desdeMs, hastaMs: region.hastaMs, etiqueta: 'PR' },
        ],
        respuesta: {
          modo: 'conteo',
          correcta: chicos,
          minimo: 1,
          maximo: 10,
          unidad: 'cuadrados chicos',
        },
        acierto: `${chicos} cuadrados chicos × ${milisegundos(MS_POR_CUADRADO_CHICO)} = ${milisegundos(prMs)}: ${juzgarPr(prMs)}.`,
        error: `Mide ${chicos}: desde que arranca la P hasta que arranca el QRS. ${chicos} × ${milisegundos(MS_POR_CUADRADO_CHICO)} = ${milisegundos(prMs)}.`,
      }
    }
    case 'ritmo-juzgar-pr':
      return retoJuzgarPr(base, azar, prDado ?? azar.elegir(PR_POSIBLES), valorEnEnunciado)
    case 'ritmo-medir-qrs': {
      const qrsMs = qrsDado ?? azar.elegir(QRS_POSIBLES)
      const { vista, region } = qrsMarcado(azar, qrsMs)
      const chicos = Math.round(cuadradosChicos(qrsMs))
      return {
        ...base,
        enunciado: '¿Cuántos cuadrados chicos mide el QRS sombreado?',
        vista,
        marcas: [
          { tipo: 'sombreado', desdeMs: region.desdeMs, hastaMs: region.hastaMs, etiqueta: 'QRS' },
        ],
        respuesta: {
          modo: 'conteo',
          correcta: chicos,
          minimo: 1,
          maximo: 6,
          unidad: 'cuadrados chicos',
        },
        acierto: `${chicos} × ${milisegundos(MS_POR_CUADRADO_CHICO)} = ${milisegundos(qrsMs)}: QRS ${juzgarQrs(qrsMs)}.`,
        error: `Mide ${chicos}: desde que arranca la Q hasta que termina la S. ${chicos} × ${milisegundos(MS_POR_CUADRADO_CHICO)} = ${milisegundos(qrsMs)}.`,
      }
    }
    case 'ritmo-juzgar-qrs':
      return retoJuzgarQrs(base, azar, qrsDado ?? azar.elegir(QRS_JUZGABLES), valorEnEnunciado)
  }
}

function retoRitmo(id: string, tipo: TipoRitmoTira | TipoRitmoIntervalo, azar: Azar): Reto {
  if (esTipoRitmoTira(tipo)) return retoRitmoTira(id, tipo, azar, 'ritmo')
  return retoRitmoIntervalo(id, tipo, azar, 'ritmo')
}

// ---------------------------------------------------------------------------------------------
// Generación

export function generarReto(nivel: NivelId, tipo: TipoReto, azar: Azar, numero: number): Reto {
  const id = `${nivel}-${tipo}-${numero}`
  if (nivel === 'lectura') throw new Error('La lectura completa se genera con generarLectura')
  if (esTipoPapel(tipo)) return retoPapel(id, tipo, azar)
  if (esTipoLatido(tipo)) return retoLatido(id, tipo, azar)
  if (esTipoFrecuencia(tipo)) return retoFrecuencia(id, tipo, azar)
  return retoRitmo(id, tipo, azar)
}

/**
 * La lectura completa: una tira con un número entero de cuadrados grandes entre dos R, y sobre
 * ella la secuencia de preguntas de una lectura ordenada: ritmo, frecuencia (regla del 300 si es
 * regular, conteo en 6 s si no), onda P, PR y QRS. Ningún enunciado dice una medida: la persona
 * cuenta los cuadrados sobre la tira, así no se aprende el resultado sin leerla. El PR y el QRS
 * se preguntan sobre un latido ampliado dibujado con esos mismos valores; sin P no se pregunta
 * el PR.
 */
export function generarLectura(azar: Azar, numero: number): Reto[] {
  const prMs = azar.elegir(PR_POSIBLES)
  const qrsMs = azar.elegir(QRS_JUZGABLES)
  // Entre dos R tiene que entrar el latido entero: PR, QRS y lugar para la T.
  const cuadradosMinimos = Math.max(2, Math.ceil((prMs + qrsMs + 160) / MS_POR_CUADRADO_GRANDE))
  const cuadrados = azar.entero(cuadradosMinimos, 6)
  const lpm = frecuenciaPorCuadradosGrandes(cuadrados)
  const ritmo = azar.elegir<Ritmo>(['regular', 'regular', 'irregular-sin-p'])
  const tira = tiraDe(azar, 6000, ritmo, {
    frecuencia: lpm,
    prMs,
    qrsMs,
    qtMs: qtPara(qrsMs),
  })
  const [primero, segundo] = latidosVisibles(tira)
  if (!primero || !segundo) throw new Error('La lectura necesita dos R visibles')
  const prefijo = `lectura-${numero}`
  const retos: Reto[] = [retoRitmoTira(`${prefijo}-ritmo`, 'ritmo-regular', azar, 'lectura', tira)]
  if (ritmo === 'regular') {
    retos.push(
      conOpciones(
        {
          id: `${prefijo}-frecuencia`,
          nivel: 'lectura',
          tipo: 'frecuencia-regla-300',
          enunciado:
            'Es regular: contá los cuadrados grandes entre las dos R marcadas. ¿Qué frecuencia es?',
          vista: { tipo: 'tira', tira },
          marcas: [
            { tipo: 'linea', enMs: primero.rMs, etiqueta: 'R' },
            { tipo: 'linea', enMs: segundo.rMs, etiqueta: 'R' },
          ],
          acierto: `${cuadrados} cuadrados grandes: ${CUADRADOS_GRANDES_POR_MINUTO} ÷ ${cuadrados} = ${latidosPorMinuto(lpm)}, ${juzgarFrecuencia(lpm)}.`,
          error: `Hay ${cuadrados} cuadrados grandes: ${CUADRADOS_GRANDES_POR_MINUTO} ÷ ${cuadrados} = ${latidosPorMinuto(lpm)}. Secuencia: ${SECUENCIA_300.join(', ')}.`,
        },
        azar,
        OPCIONES_300,
        String(lpm),
      ),
    )
  } else {
    retos.push(
      retoContarQrs(
        { id: `${prefijo}-frecuencia`, nivel: 'lectura', tipo: 'frecuencia-contar-qrs' },
        tira,
        'Es irregular, así que la regla del 300 no sirve: contá los QRS en los 6 segundos.',
      ),
    )
  }
  retos.push(retoRitmoTira(`${prefijo}-p`, 'ritmo-p', azar, 'lectura', tira))
  if (ritmoTieneP(ritmo)) {
    retos.push(
      retoRitmoIntervalo(`${prefijo}-pr`, 'ritmo-juzgar-pr', azar, 'lectura', {
        prMs,
        valorEnEnunciado: false,
      }),
    )
  }
  retos.push(
    retoRitmoIntervalo(`${prefijo}-qrs`, 'ritmo-juzgar-qrs', azar, 'lectura', {
      qrsMs,
      valorEnEnunciado: false,
    }),
  )
  return retos
}

// La pantalla de un nivel: un reto por vez, corrección inmediata y «Siguiente». Al llegar a la meta
// muestra el cierre del nivel. La lectura completa suma el reloj. Un reto con tira se puede leer y
// responder en la tira apaisada: con el botón en el celular, o sola al girar el teléfono. Desde
// 768 px la tira sale de la columna de lectura, tan ancha como entre en la ventana; al responder
// muestra encima la prueba de la respuesta. Cada opción se elige con la tecla de su número.

import { ArrowLeft, CircleCheck, CircleX, Expand, Flame } from 'lucide-react'
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

import { Conteo } from '@/componentes/Conteo'
import { ModoApaisado } from '@/componentes/ModoApaisado'
import { Opciones } from '@/componentes/Opciones'
import { Papel } from '@/componentes/Papel'
import { TiraEcg, type PropsZonas } from '@/componentes/TiraEcg'
import { Button } from '@/components/ui/button'
import { FOCO_PROGRAMATICO } from '@/lib/foco'
import { anchoParaAlto } from '@/lib/tira'
import { ANCHO_ESCRITORIO, TELEFONO_APAISADO, VERTICAL, useCoincide } from '@/lib/medios'
import { numero, segundos } from '@/motor/formato'
import { ahora } from '@/motor/reloj'
import {
  nivelPorId,
  type Nivel as DatosNivel,
  type NivelId,
  type RespuestaDada,
  type Reto,
} from '@/motor/retos'
import { avance, avanzar, crearSesion, responder, terminada, type Sesion } from '@/motor/sesion'

export type CierreNivel = {
  nivel: NivelId
  aciertos: number
  errores: number
  mejorRacha: number
  segundos: number
}

type Props = {
  nivel: NivelId
  semilla: number
  onSalir: () => void
  onCierre: (cierre: CierreNivel) => void
}

type Fase =
  | { nombre: 'pregunta' }
  | { nombre: 'respondida'; correcto: boolean; dada: RespuestaDada }
  | { nombre: 'cierre'; segundos: number }

type PropsVista = {
  reto: Reto
  respondida: boolean
  zonas: PropsZonas
  refTira: RefObject<HTMLDivElement | null>
  refBotonApaisada: RefObject<HTMLButtonElement | null>
  onApaisada: () => void
}

function VistaReto({ reto, respondida, zonas, refTira, refBotonApaisada, onApaisada }: PropsVista) {
  const vista = reto.vista
  switch (vista.tipo) {
    case 'papel':
      return <Papel resaltar={vista.resaltar} />
    case 'latido':
      return (
        <div className="flex justify-center">
          <TiraEcg
            tira={vista.tira}
            etiqueta="Un latido ampliado sobre papel milimetrado"
            marcas={reto.marcas}
            altoMm={17}
            baseMm={4}
            maxPxPorMm={22}
            {...zonas}
          />
        </div>
      )
    case 'tira': {
      // Desde 768 px la tira sale de la columna: tan ancha como su alto disponible permita
      // (`--alto-tira`, que mide `useAltoTira`), nunca más angosta que la columna ni más ancha que
      // la página sin su margen (100cqw de `main`). Se centra sobre la columna con margen negativo.
      const ancho = {
        '--ancho-tira': `clamp(100%, ${anchoParaAlto(vista.tira, 'var(--alto-tira, 100dvh)')}, 100cqw)`,
      } as CSSProperties
      return (
        <div className="flex flex-col gap-2">
          <div
            ref={refTira}
            className="md:ms-[calc((100%_-_var(--ancho-tira))/2)] md:w-(--ancho-tira)"
            style={ancho}
          >
            <TiraEcg
              tira={vista.tira}
              etiqueta={`Tira de ${segundos(vista.tira.duracionMs / 1000, 0)} sobre papel milimetrado`}
              marcas={reto.marcas}
              evidencia={respondida ? reto.evidencia : []}
              {...zonas}
            />
          </div>
          {/* Sólo en el celular: desde 768 px la tira ya entra a lo ancho. */}
          <div className="flex justify-end md:hidden">
            <Button
              ref={refBotonApaisada}
              variant="outline"
              size="lg"
              className="px-3"
              onClick={onApaisada}
            >
              <Expand data-icon="inline-start" aria-hidden="true" />
              Ver la tira apaisada
            </Button>
          </div>
        </div>
      )
    }
    case 'texto':
      return null
  }
}

type PropsRetroalimentacion = {
  reto: Reto
  correcto: boolean
  /** En la tira apaisada: el veredicto y la explicación en el mismo renglón, con menos relleno. */
  compacta?: boolean
}

function Retroalimentacion({ reto, correcto, compacta = false }: PropsRetroalimentacion) {
  if (compacta) {
    return (
      <div
        className={
          correcto
            ? 'flex items-start gap-2 rounded-lg border border-exito bg-exito-suave px-3 py-2 text-exito'
            : 'flex items-start gap-2 rounded-lg border border-peligro bg-peligro-suave px-3 py-2 text-peligro'
        }
      >
        {correcto ? (
          <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        ) : (
          <CircleX className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        )}
        <p className="cuerpo">
          <span className="font-semibold">{correcto ? 'Bien.' : 'No era esa.'}</span>{' '}
          {correcto ? reto.acierto : reto.error}
        </p>
      </div>
    )
  }
  return (
    <div
      className={
        correcto
          ? 'flex items-start gap-3 rounded-lg border border-exito bg-exito-suave p-4 text-exito'
          : 'flex items-start gap-3 rounded-lg border border-peligro bg-peligro-suave p-4 text-peligro'
      }
    >
      {correcto ? (
        <CircleCheck className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      ) : (
        <CircleX className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
      )}
      <div>
        <p className="cuerpo font-semibold">{correcto ? 'Bien.' : 'No era esa.'}</p>
        <p className="cuerpo">{correcto ? reto.acierto : reto.error}</p>
      </div>
    </div>
  )
}

type PropsCierre = {
  datos: DatosNivel
  sesion: Sesion
  segundosTotales: number
  onSalir: () => void
  onReiniciar: () => void
}

function Cierre({ datos, sesion, segundosTotales, onSalir, onReiniciar }: PropsCierre) {
  const encabezado = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    encabezado.current?.focus()
  }, [])
  const total = sesion.aciertos + sesion.errores
  const resumen =
    datos.id === 'lectura'
      ? `Leíste ${numero(total)} preguntas en ${segundos(segundosTotales, 0)}: ${numero(sesion.aciertos)} bien y ${numero(sesion.errores)} mal.`
      : `${numero(sesion.aciertos)} aciertos, ${numero(sesion.errores)} errores en el camino y una racha máxima de ${numero(sesion.mejorRacha)}.`
  return (
    <section className="momento-entrada mx-auto flex w-full max-w-xl flex-col gap-6 rounded-xl border bg-superficie p-6">
      <h1 ref={encabezado} tabIndex={-1} className={`display ${FOCO_PROGRAMATICO}`}>
        Nivel {datos.numero} completo
      </h1>
      <p className="cuerpo">{resumen}</p>
      <dl className="grid grid-cols-3 gap-4">
        <div>
          <dt className="pequeno text-texto-tenue">Aciertos</dt>
          <dd className="cifra tabular-nums">{numero(sesion.aciertos)}</dd>
        </div>
        <div>
          <dt className="pequeno text-texto-tenue">Errores</dt>
          <dd className="cifra tabular-nums">{numero(sesion.errores)}</dd>
        </div>
        <div>
          <dt className="pequeno text-texto-tenue">Mejor racha</dt>
          <dd className="cifra tabular-nums">{numero(sesion.mejorRacha)}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onSalir}>
          Volver a los niveles
        </Button>
        <Button size="lg" variant="outline" onClick={onReiniciar}>
          Jugar de nuevo
        </Button>
      </div>
    </section>
  )
}

function Encabezado({
  datos,
  racha,
  onSalir,
}: {
  datos: DatosNivel
  racha: number
  onSalir: () => void
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button variant="ghost" size="sm" onClick={onSalir}>
        <ArrowLeft data-icon="inline-start" aria-hidden="true" />
        Niveles
      </Button>
      <h1 className="titulo grow">
        Nivel {datos.numero}: {datos.titulo}
      </h1>
      <p
        className="pequeno flex items-center gap-1 text-racha"
        aria-label={`Racha de ${numero(racha)}`}
      >
        <Flame className="size-4" aria-hidden="true" />
        <span className="tabular-nums">{numero(racha)}</span> {racha === 1 ? 'seguido' : 'seguidos'}
      </p>
    </header>
  )
}

function BarraAvance({ hechos, meta }: { hechos: number; meta: number }) {
  const valor = Math.min(hechos, meta)
  return (
    <div>
      <div className="pequeno mb-1 flex justify-between text-texto-tenue">
        <span id="etiqueta-avance">Avance del nivel</span>
        <span className="tabular-nums">
          {numero(valor)} de {numero(meta)}
        </span>
      </div>
      <progress
        className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primario [&::-webkit-progress-bar]:bg-superficie [&::-webkit-progress-value]:bg-primario"
        value={valor}
        max={meta}
        aria-labelledby="etiqueta-avance"
      />
    </div>
  )
}

type PropsRespuesta = {
  reto: Reto
  dada: RespuestaDada | null
  correctaId: string
  onContestar: (dada: RespuestaDada) => void
  /** En la tira apaisada: opciones en una fila y contador de 44 px a cualquier ancho. */
  apaisada?: boolean
  /** Las teclas numéricas eligen: sólo en la vista que se ve, la pantalla o la tira apaisada. */
  atajos: boolean
}

function Respuesta({
  reto,
  dada,
  correctaId,
  onContestar,
  apaisada = false,
  atajos,
}: PropsRespuesta) {
  const respondida = dada !== null
  switch (reto.respuesta.modo) {
    case 'opciones':
      return (
        <Opciones
          opciones={reto.respuesta.opciones}
          elegida={dada === null ? null : String(dada)}
          correcta={respondida ? correctaId : null}
          onElegir={onContestar}
          disposicion={apaisada ? 'fila' : 'columnas'}
          atajos={atajos}
        />
      )
    case 'conteo':
      return (
        <Conteo
          key={reto.id}
          minimo={reto.respuesta.minimo}
          maximo={reto.respuesta.maximo}
          unidad={reto.respuesta.unidad}
          deshabilitado={respondida}
          tactil={apaisada}
          onResponder={onContestar}
        />
      )
    case 'zona':
      return respondida ? null : (
        <p className="pequeno text-texto-tenue">Tocá directamente sobre el trazado.</p>
      )
  }
}

/**
 * Cuándo se ve la tira apaisada. Se abre con su botón o sola, con el teléfono girado. Abierta con
 * el botón, queda abierta aunque el teléfono gire; abierta sola, se cierra al volver a la vertical.
 * Cerrada con «Salir» o Escape, no vuelve a abrirse sola hasta que el teléfono pase por la vertical.
 * Sólo en retos con tira: uno sin tira la cierra.
 */
function useTiraApaisada(conTira: boolean) {
  const telefonoApaisado = useCoincide(TELEFONO_APAISADO)
  const vertical = useCoincide(VERTICAL)
  const [porBoton, setPorBoton] = useState(false)
  const [descartada, setDescartada] = useState(false)
  const [apaisadoAntes, setApaisadoAntes] = useState(telefonoApaisado)
  if (apaisadoAntes !== telefonoApaisado) {
    setApaisadoAntes(telefonoApaisado)
    if (!telefonoApaisado) setDescartada(false)
  }
  return {
    abierta: conTira && (porBoton || (telefonoApaisado && !descartada)),
    /** Con la pantalla en vertical, el contenido gira para leerse con el teléfono de costado. */
    girada: vertical,
    abrir: () => setPorBoton(true),
    salir: () => {
      setPorBoton(false)
      if (telefonoApaisado) setDescartada(true)
    },
    /** Al pasar a un reto sin tira o terminar: lo abierto con el botón no se arrastra. */
    olvidarBoton: () => setPorBoton(false),
  }
}

/**
 * Lo que ocupa el resultado con el veredicto y dos renglones de explicación: borde, relleno `p-4`
 * y tres renglones de `cuerpo` (17 px × 1,55). Se reserva antes de responder para que la tira no
 * cambie de tamaño al aparecer el resultado; uno más largo la achica.
 */
const RESULTADO_RESERVADO_PX = 2 + 2 * 16 + 3 * 17 * 1.55
/** Aire bajo «Siguiente» para que su anillo de foco (2 px a 2 px del botón) también entre. */
const AIRE_INFERIOR_PX = 8

/**
 * Desde 768 px, el alto que puede tener la tira para que el reto respondido entre en la ventana
 * sin desplazarse: encabezado, avance, consigna, tira, respuesta, resultado y «Siguiente». Lo
 * escribe en la sección como `--alto-tira`; la tira toma el ancho que corresponde a ese alto con
 * la misma regla de ajuste a una caja que la tira apaisada. Vuelve a medir cuando cambia el
 * contenido o la ventana.
 */
function useAltoTira(
  seccion: RefObject<HTMLElement | null>,
  tira: RefObject<HTMLElement | null>,
  resultado: RefObject<HTMLElement | null>,
  activa: boolean,
  clave: string,
) {
  useLayoutEffect(() => {
    const s = seccion.current
    const t = tira.current
    const r = resultado.current
    if (!activa || !s || !t || !r) return
    const medir = () => {
      // Alturas de maquetación (`offsetHeight`): el pulso del trazo escala la tira al acertar y no
      // debe contar.
      const altoResultado = r.offsetHeight
      const resto =
        s.offsetHeight -
        t.offsetHeight -
        altoResultado +
        Math.max(altoResultado, RESULTADO_RESERVADO_PX)
      const arriba = s.getBoundingClientRect().top + window.scrollY
      const alto = Math.floor(window.innerHeight - arriba - resto - AIRE_INFERIOR_PX)
      s.style.setProperty('--alto-tira', `${alto}px`)
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(s)
    window.addEventListener('resize', medir)
    return () => {
      observador.disconnect()
      window.removeEventListener('resize', medir)
      s.style.removeProperty('--alto-tira')
    }
  }, [seccion, tira, resultado, activa, clave])
}

export function Nivel({ nivel, semilla, onSalir, onCierre }: Props) {
  const datos = nivelPorId(nivel)
  const [sesion, setSesion] = useState<Sesion>(() => crearSesion(nivel, semilla))
  const [fase, setFase] = useState<Fase>({ nombre: 'pregunta' })
  const [inicioMs, setInicioMs] = useState(() => ahora())
  const botonSiguiente = useRef<HTMLButtonElement>(null)
  const enunciado = useRef<HTMLHeadingElement>(null)
  const botonApaisada = useRef<HTMLButtonElement>(null)
  const tituloApaisada = useRef<HTMLHeadingElement>(null)
  const siguienteApaisada = useRef<HTMLButtonElement>(null)
  const seccion = useRef<HTMLElement>(null)
  const tiraAncha = useRef<HTMLDivElement>(null)
  const filaResultado = useRef<HTMLDivElement>(null)

  const conTira = sesion.actual.vista.tipo === 'tira'
  const modo = useTiraApaisada(conTira)
  const apaisada = modo.abierta
  const escritorio = useCoincide(ANCHO_ESCRITORIO)
  useAltoTira(
    seccion,
    tiraAncha,
    filaResultado,
    escritorio && conTira && fase.nombre !== 'cierre',
    sesion.actual.id,
  )

  const enfocarSiguiente = useEffectEvent(() => {
    if (fase.nombre !== 'respondida') return
    ;(apaisada ? siguienteApaisada : botonSiguiente).current?.focus()
  })
  useEffect(() => {
    enfocarSiguiente()
  }, [fase])

  // Cada reto nuevo lleva el foco a su enunciado: «Siguiente» desaparece y el teclado no vuelve al
  // principio de la página.
  const enfocarEnunciado = useEffectEvent(() => {
    ;(apaisada ? tituloApaisada : enunciado).current?.focus()
  })
  useEffect(() => {
    enfocarEnunciado()
  }, [sesion.actual.id])

  // Al cerrar, el foco vuelve al botón que la abre; si no se ve (desde 768 px o en un reto sin
  // tira), al enunciado.
  const focoAlCerrar = () => {
    const boton = botonApaisada.current
    return boton && boton.offsetParent !== null ? boton : enunciado.current
  }

  const contestar = (dada: RespuestaDada) => {
    if (fase.nombre !== 'pregunta') return
    const resultado = responder(sesion, dada)
    setSesion(resultado.sesion)
    setFase({ nombre: 'respondida', correcto: resultado.correcto, dada })
  }

  const siguiente = () => {
    if (!terminada(sesion)) {
      const nueva = avanzar(sesion)
      setSesion(nueva)
      setFase({ nombre: 'pregunta' })
      // Un reto sin tira cierra la tira apaisada y muestra la pantalla de siempre.
      if (nueva.actual.vista.tipo !== 'tira') modo.olvidarBoton()
      return
    }
    modo.olvidarBoton()
    const transcurrido = Math.round((ahora() - inicioMs) / 1000)
    setFase({ nombre: 'cierre', segundos: transcurrido })
    onCierre({
      nivel,
      aciertos: sesion.aciertos,
      errores: sesion.errores,
      mejorRacha: sesion.mejorRacha,
      segundos: transcurrido,
    })
  }

  const reiniciar = () => {
    setSesion(crearSesion(nivel, semilla + 1))
    setInicioMs(ahora())
    setFase({ nombre: 'pregunta' })
    modo.olvidarBoton()
  }

  if (fase.nombre === 'cierre') {
    return (
      <Cierre
        datos={datos}
        sesion={sesion}
        segundosTotales={fase.segundos}
        onSalir={onSalir}
        onReiniciar={reiniciar}
      />
    )
  }

  const reto = sesion.actual
  const respondida = fase.nombre === 'respondida'
  const dada = fase.nombre === 'respondida' ? fase.dada : null
  const correcto = fase.nombre === 'respondida' && fase.correcto
  const correctaId = String(reto.respuesta.correcta)
  const textoSiguiente = terminada(sesion) ? 'Ver resultado' : 'Siguiente'
  const zonas: PropsZonas =
    reto.respuesta.modo === 'zona'
      ? {
          zonas: reto.respuesta.zonas,
          estadoZonas: {
            elegida: dada === null ? null : String(dada),
            correcta: respondida ? correctaId : null,
          },
          onZona: contestar,
          pulso: correcto,
        }
      : { pulso: correcto }

  return (
    <section ref={seccion} className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Encabezado datos={datos} racha={sesion.racha} onSalir={onSalir} />
      <BarraAvance {...avance(sesion)} />
      <h2 ref={enunciado} tabIndex={-1} className={`enunciado ${FOCO_PROGRAMATICO}`}>
        {reto.enunciado}
      </h2>
      <VistaReto
        reto={reto}
        respondida={respondida}
        zonas={zonas}
        refTira={tiraAncha}
        refBotonApaisada={botonApaisada}
        onApaisada={modo.abrir}
      />
      <Respuesta
        reto={reto}
        dada={dada}
        correctaId={correctaId}
        onContestar={contestar}
        atajos={!apaisada}
      />
      {/* Desde 768 px «Siguiente» va al lado del resultado: así la tira ancha, el resultado y el
          botón entran en la ventana. Más angosto, debajo, como siempre. */}
      <div ref={filaResultado} className="flex flex-col gap-5 md:flex-row md:items-center">
        {/* Con la tira apaisada abierta, el resultado se anuncia desde ella: esta región calla
            para que no se oiga dos veces (el diálogo oculta el fondo salvo las regiones vivas). */}
        <div
          role="status"
          aria-label="Resultado del reto"
          aria-live={apaisada ? 'off' : 'polite'}
          className="min-h-6 md:grow"
        >
          {respondida && <Retroalimentacion reto={reto} correcto={correcto} />}
        </div>
        {respondida && (
          <div className="flex justify-end">
            <Button ref={botonSiguiente} size="lg" onClick={siguiente}>
              {textoSiguiente}
            </Button>
          </div>
        )}
      </div>
      {conTira && (
        <ModoApaisado
          abierto={apaisada}
          girada={modo.girada}
          reto={reto}
          pulso={correcto}
          refTitulo={tituloApaisada}
          onSalir={modo.salir}
          focoFinal={focoAlCerrar}
          respuesta={
            <Respuesta
              reto={reto}
              dada={dada}
              correctaId={correctaId}
              onContestar={contestar}
              apaisada
              atajos={apaisada}
            />
          }
          resultado={
            respondida ? <Retroalimentacion reto={reto} correcto={correcto} compacta /> : null
          }
          siguiente={
            <Button
              ref={siguienteApaisada}
              size="lg"
              className="min-h-11 shrink-0 px-4"
              onClick={siguiente}
            >
              {textoSiguiente}
            </Button>
          }
        />
      )}
    </section>
  )
}

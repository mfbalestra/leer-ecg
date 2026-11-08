// La pantalla de un nivel: un reto por vez, corrección inmediata y «Siguiente». Al llegar a la meta
// muestra el cierre del nivel. La lectura completa suma el reloj.

import { ArrowLeft, CircleCheck, CircleX, Flame } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Conteo } from '@/componentes/Conteo'
import { Opciones } from '@/componentes/Opciones'
import { Papel } from '@/componentes/Papel'
import { TiraEcg, type PropsZonas } from '@/componentes/TiraEcg'
import { Button } from '@/components/ui/button'
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

/** Un título que recibe el foco por código: sin anillo al hacer clic, con anillo desde el teclado. */
export const FOCO_PROGRAMATICO =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-ring'

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

function VistaReto({ reto, zonas }: { reto: Reto; zonas: PropsZonas }) {
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
    case 'tira':
      return (
        <TiraEcg
          tira={vista.tira}
          etiqueta={`Tira de ${segundos(vista.tira.duracionMs / 1000, 0)} sobre papel milimetrado`}
          marcas={reto.marcas}
          {...zonas}
        />
      )
    case 'texto':
      return null
  }
}

function Retroalimentacion({ reto, correcto }: { reto: Reto; correcto: boolean }) {
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
}

function Respuesta({ reto, dada, correctaId, onContestar }: PropsRespuesta) {
  const respondida = dada !== null
  switch (reto.respuesta.modo) {
    case 'opciones':
      return (
        <Opciones
          opciones={reto.respuesta.opciones}
          elegida={dada === null ? null : String(dada)}
          correcta={respondida ? correctaId : null}
          onElegir={onContestar}
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
          onResponder={onContestar}
        />
      )
    case 'zona':
      return respondida ? null : (
        <p className="pequeno text-texto-tenue">Tocá directamente sobre el trazado.</p>
      )
  }
}

export function Nivel({ nivel, semilla, onSalir, onCierre }: Props) {
  const datos = nivelPorId(nivel)
  const [sesion, setSesion] = useState<Sesion>(() => crearSesion(nivel, semilla))
  const [fase, setFase] = useState<Fase>({ nombre: 'pregunta' })
  const [inicioMs, setInicioMs] = useState(() => ahora())
  const botonSiguiente = useRef<HTMLButtonElement>(null)
  const enunciado = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (fase.nombre === 'respondida') botonSiguiente.current?.focus()
  }, [fase])

  // Cada reto nuevo lleva el foco a su enunciado: «Siguiente» desaparece y el teclado no vuelve al
  // principio de la página.
  useEffect(() => {
    enunciado.current?.focus()
  }, [sesion.actual.id])

  const contestar = (dada: RespuestaDada) => {
    if (fase.nombre !== 'pregunta') return
    const resultado = responder(sesion, dada)
    setSesion(resultado.sesion)
    setFase({ nombre: 'respondida', correcto: resultado.correcto, dada })
  }

  const siguiente = () => {
    if (!terminada(sesion)) {
      setSesion(avanzar(sesion))
      setFase({ nombre: 'pregunta' })
      return
    }
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
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Encabezado datos={datos} racha={sesion.racha} onSalir={onSalir} />
      <BarraAvance {...avance(sesion)} />
      <h2 ref={enunciado} tabIndex={-1} className={`enunciado ${FOCO_PROGRAMATICO}`}>
        {reto.enunciado}
      </h2>
      <VistaReto reto={reto} zonas={zonas} />
      <Respuesta reto={reto} dada={dada} correctaId={correctaId} onContestar={contestar} />
      <div role="status" aria-label="Resultado del reto" aria-live="polite" className="min-h-6">
        {respondida && <Retroalimentacion reto={reto} correcto={correcto} />}
      </div>
      {respondida && (
        <div className="flex justify-end">
          <Button ref={botonSiguiente} size="lg" onClick={siguiente}>
            {terminada(sesion) ? 'Ver resultado' : 'Siguiente'}
          </Button>
        </div>
      )}
    </section>
  )
}

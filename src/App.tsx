// Una sola ruta y tres pantallas: inicio, nivel y referencias. El progreso se guarda en el navegador.

import { useState } from 'react'

import { Inicio } from '@/pantallas/Inicio'
import { Nivel, type CierreNivel } from '@/pantallas/Nivel'
import { Referencias } from '@/pantallas/Referencias'
import { semillaDesde } from '@/motor/azar'
import {
  cargarProgreso,
  guardarProgreso,
  registrarExamen,
  registrarNivel,
  type Almacen,
  type Progreso,
} from '@/motor/progreso'
import { ahora } from '@/motor/reloj'
import type { NivelId } from '@/motor/retos'

type Pantalla =
  | { nombre: 'inicio' }
  | { nombre: 'nivel'; id: NivelId; semilla: number }
  | { nombre: 'referencias' }

/**
 * Semilla de cada partida: del reloj, salvo que la dirección traiga `?semilla=N`, que fija la
 * secuencia de retos (sirve para reproducir una partida y para las pruebas de extremo a extremo).
 */
function semillaDePartida(partida: number): number {
  const fija = new URLSearchParams(window.location.search).get('semilla')
  if (fija !== null && /^\d+$/.test(fija)) return Number(fija) + partida
  return semillaDesde(ahora(), partida)
}

function almacenDelNavegador(): Almacen | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function App() {
  const [almacen] = useState(almacenDelNavegador)
  const [progreso, setProgreso] = useState<Progreso>(() => cargarProgreso(almacen))
  const [pantalla, setPantalla] = useState<Pantalla>({ nombre: 'inicio' })
  const [partidas, setPartidas] = useState(0)

  const actualizar = (nuevo: Progreso) => {
    setProgreso(nuevo)
    guardarProgreso(almacen, nuevo)
  }

  const jugar = (id: NivelId) => {
    setPartidas((n) => n + 1)
    setPantalla({ nombre: 'nivel', id, semilla: semillaDePartida(partidas) })
  }

  const cerrarNivel = (cierre: CierreNivel) => {
    let nuevo = registrarNivel(progreso, cierre.nivel, cierre.mejorRacha)
    if (cierre.nivel === 'lectura') {
      nuevo = registrarExamen(nuevo, {
        aciertos: cierre.aciertos,
        total: cierre.aciertos + cierre.errores,
        segundos: cierre.segundos,
      })
    }
    actualizar(nuevo)
  }

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-6 sm:py-10">
      {pantalla.nombre === 'inicio' && (
        <Inicio
          progreso={progreso}
          onJugar={jugar}
          onReferencias={() => setPantalla({ nombre: 'referencias' })}
        />
      )}
      {pantalla.nombre === 'nivel' && (
        <Nivel
          key={`${pantalla.id}-${pantalla.semilla}`}
          nivel={pantalla.id}
          semilla={pantalla.semilla}
          onSalir={() => setPantalla({ nombre: 'inicio' })}
          onCierre={cerrarNivel}
        />
      )}
      {pantalla.nombre === 'referencias' && (
        <Referencias onVolver={() => setPantalla({ nombre: 'inicio' })} />
      )}
    </main>
  )
}

// Ayudas compartidas por los circuitos e2e: chequeos por estado, respuestas que el motor sabe
// correctas y la apertura de un nivel con la semilla fija.

import { expect, type Locator, type Page } from '@playwright/test'

import { axeSinViolaciones } from '../kit/axe.ts'
import { oficioSinFallas } from '../kit/oficio.ts'
import { tecladoSinFallas } from '../kit/teclado.ts'
import { numero } from '../src/motor/formato.ts'
import { nivelPorId, type NivelId, type Reto } from '../src/motor/retos.ts'
import { crearSesion, type Sesion } from '../src/motor/sesion.ts'

export const opcionesOficio = { acento: '--primario', estrategia: 'committed' as const }

/** Con `?semilla=N` la app genera la misma secuencia que el motor en Node: el test sabe la respuesta. */
export const SEMILLA = 41

export async function todosLosChequeos(page: Page, estado: string) {
  // Las animaciones de entrada (momento-entrada) mezclan el color con el fondo: se mide al terminar.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  )
  await axeSinViolaciones(page, estado)
  await oficioSinFallas(page, estado, opcionesOficio)
  await tecladoSinFallas(page, estado)
}

/** Contesta el reto en pantalla (o dentro de `raiz`) con la respuesta que el motor dice que es correcta. */
export async function contestarBien(raiz: Page | Locator, reto: Reto) {
  const r = reto.respuesta
  switch (r.modo) {
    case 'opciones': {
      const correcta = r.opciones.find((o) => o.id === r.correcta)
      if (!correcta) throw new Error('El reto no ofrece su respuesta correcta')
      await raiz
        .getByRole('group', { name: 'Opciones' })
        .getByRole('button', { name: correcta.etiqueta, exact: true })
        .click()
      break
    }
    case 'zona': {
      const zona = r.zonas.find((z) => z.id === r.correcta)
      if (!zona) throw new Error('El reto no ofrece su zona correcta')
      await raiz
        .getByRole('group', { name: 'Partes del latido para tocar' })
        .getByRole('button', { name: zona.etiqueta, exact: true })
        .click()
      break
    }
    case 'conteo': {
      const mas = raiz.getByRole('button', { name: 'Uno más' })
      for (let i = r.minimo; i < r.correcta; i += 1) await mas.click()
      await expect(raiz.getByRole('group', { name: /^Contador de/ }).locator('output')).toHaveText(
        numero(r.correcta),
      )
      await raiz.getByRole('button', { name: 'Responder' }).click()
      break
    }
  }
}

export async function contestarMal(raiz: Page | Locator, reto: Reto) {
  const r = reto.respuesta
  if (r.modo === 'conteo') {
    await raiz.getByRole('button', { name: 'Uno más' }).click()
    await raiz.getByRole('button', { name: 'Responder' }).click()
    return
  }
  const otra = (r.modo === 'opciones' ? r.opciones : r.zonas).find((o) => o.id !== r.correcta)
  if (!otra) throw new Error('El reto no tiene una respuesta incorrecta')
  const grupo = r.modo === 'opciones' ? 'Opciones' : 'Partes del latido para tocar'
  await raiz
    .getByRole('group', { name: grupo })
    .getByRole('button', { name: otra.etiqueta, exact: true })
    .click()
}

export async function abrirNivel(page: Page, nivel: NivelId): Promise<Sesion> {
  await page.goto(`/?semilla=${SEMILLA}`)
  const datos = nivelPorId(nivel)
  await page.getByRole('button', { name: new RegExp(`nivel ${datos.numero}:`) }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(datos.titulo)
  return crearSesion(nivel, SEMILLA)
}

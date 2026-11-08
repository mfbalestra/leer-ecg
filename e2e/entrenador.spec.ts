import { expect, test, type Page } from '@playwright/test'

import { axeSinViolaciones } from '../kit/axe.ts'
import { oficioSinFallas } from '../kit/oficio.ts'
import { tecladoSinFallas } from '../kit/teclado.ts'
import { numero } from '../src/motor/formato.ts'
import { nivelPorId, type NivelId, type Reto } from '../src/motor/retos.ts'
import { avanzar, crearSesion, responder, terminada, type Sesion } from '../src/motor/sesion.ts'

const opcionesOficio = { acento: '--primario', estrategia: 'committed' as const }

/** Con `?semilla=N` la app genera la misma secuencia que el motor en Node: el test sabe la respuesta. */
const SEMILLA = 41

async function todosLosChequeos(page: Page, estado: string) {
  // Las animaciones de entrada (momento-entrada) mezclan el color con el fondo: se mide al terminar.
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  )
  await axeSinViolaciones(page, estado)
  await oficioSinFallas(page, estado, opcionesOficio)
  await tecladoSinFallas(page, estado)
}

/** Contesta el reto en pantalla con la respuesta que el motor dice que es correcta. */
async function contestarBien(page: Page, reto: Reto) {
  const r = reto.respuesta
  switch (r.modo) {
    case 'opciones': {
      const correcta = r.opciones.find((o) => o.id === r.correcta)
      if (!correcta) throw new Error('El reto no ofrece su respuesta correcta')
      await page
        .getByRole('group', { name: 'Opciones' })
        .getByRole('button', { name: correcta.etiqueta, exact: true })
        .click()
      break
    }
    case 'zona': {
      const zona = r.zonas.find((z) => z.id === r.correcta)
      if (!zona) throw new Error('El reto no ofrece su zona correcta')
      await page
        .getByRole('group', { name: 'Partes del latido para tocar' })
        .getByRole('button', { name: zona.etiqueta, exact: true })
        .click()
      break
    }
    case 'conteo': {
      const mas = page.getByRole('button', { name: 'Uno más' })
      for (let i = r.minimo; i < r.correcta; i += 1) await mas.click()
      await expect(page.getByRole('group', { name: /^Contador de/ }).locator('output')).toHaveText(
        numero(r.correcta),
      )
      await page.getByRole('button', { name: 'Responder' }).click()
      break
    }
  }
}

async function contestarMal(page: Page, reto: Reto) {
  const r = reto.respuesta
  if (r.modo === 'conteo') {
    await page.getByRole('button', { name: 'Uno más' }).click()
    await page.getByRole('button', { name: 'Responder' }).click()
    return
  }
  const otra = (r.modo === 'opciones' ? r.opciones : r.zonas).find((o) => o.id !== r.correcta)
  if (!otra) throw new Error('El reto no tiene una respuesta incorrecta')
  const grupo = r.modo === 'opciones' ? 'Opciones' : 'Partes del latido para tocar'
  await page
    .getByRole('group', { name: grupo })
    .getByRole('button', { name: otra.etiqueta, exact: true })
    .click()
}

async function abrirNivel(page: Page, nivel: NivelId): Promise<Sesion> {
  await page.goto(`/?semilla=${SEMILLA}`)
  const datos = nivelPorId(nivel)
  await page.getByRole('button', { name: new RegExp(`nivel ${datos.numero}:`) }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText(datos.titulo)
  return crearSesion(nivel, SEMILLA)
}

test('inicio: niveles, referencias y vuelta, accesibles y operables por teclado', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Entrenador de ECG' })).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(5)
  await todosLosChequeos(page, 'inicio')

  await page.getByRole('button', { name: 'Valores normales y fuentes' }).click()
  await expect(page.getByRole('heading', { name: 'Valores normales y fuentes' })).toBeVisible()
  await expect(page.getByRole('row')).toHaveCount(15)
  await todosLosChequeos(page, 'referencias')

  await page.getByRole('button', { name: 'Inicio' }).click()
  await expect(page.getByRole('heading', { name: 'Entrenador de ECG' })).toBeVisible()
})

test('nivel 1: acierto, error con explicación, avance y cierre; el progreso queda guardado', async ({
  page,
}) => {
  let sesion = await abrirNivel(page, 'papel')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(sesion.actual.enunciado)
  await todosLosChequeos(page, 'reto-papel')

  // Un error: no suma, explica y deja seguir.
  await contestarMal(page, sesion.actual)
  sesion = responder(sesion, '__mal__').sesion
  await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText(
    'No era esa.',
  )
  await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText(
    sesion.actual.error,
  )
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '0')
  await todosLosChequeos(page, 'reto-incorrecto')
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { level: 2 })).toBeFocused()
  sesion = avanzar(sesion)

  // Aciertos hasta completar el nivel.
  let primero = true
  while (!terminada(sesion)) {
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(sesion.actual.enunciado)
    await contestarBien(page, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText('Bien.')
    if (primero) {
      await todosLosChequeos(page, 'reto-correcto')
      primero = false
    }
    if (!terminada(sesion)) {
      await page.getByRole('button', { name: 'Siguiente' }).click()
      sesion = avanzar(sesion)
    }
  }
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', String(sesion.meta))
  await page.getByRole('button', { name: 'Ver resultado' }).click()
  await expect(page.getByRole('heading', { name: 'Nivel 1 completo' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nivel 1 completo' })).toBeFocused()
  await todosLosChequeos(page, 'nivel-completo')

  await page.getByRole('button', { name: 'Volver a los niveles' }).click()
  await expect(page.getByRole('listitem').first()).toContainText('Completado')
  await page.reload()
  await expect(page.getByRole('listitem').first()).toContainText('Completado')
})

test('nivel 2: tocar el trazado responde con zonas accesibles y marca la correcta', async ({
  page,
}) => {
  let sesion = await abrirNivel(page, 'latido')
  // Avanza hasta un reto de tocar, contestando bien los demás.
  while (sesion.actual.respuesta.modo !== 'zona') {
    await contestarBien(page, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    await page.getByRole('button', { name: 'Siguiente' }).click()
    sesion = avanzar(sesion)
  }
  const zonas = page.getByRole('group', { name: 'Partes del latido para tocar' })
  await expect(zonas.getByRole('button')).toHaveCount(4)
  await todosLosChequeos(page, 'reto-tocar')
  await contestarBien(page, sesion.actual)
  await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText('Bien.')
  await expect(zonas.getByRole('button', { pressed: true })).toHaveCount(1)
})

test('nivel 3: el contador responde con el teclado y la lectura completa cierra con el reloj', async ({
  page,
}) => {
  let sesion = await abrirNivel(page, 'frecuencia')
  while (sesion.actual.respuesta.modo !== 'conteo') {
    await contestarBien(page, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    await page.getByRole('button', { name: 'Siguiente' }).click()
    sesion = avanzar(sesion)
  }
  await todosLosChequeos(page, 'reto-conteo')
  await contestarBien(page, sesion.actual)
  await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText('Bien.')

  sesion = await abrirNivel(page, 'lectura')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(sesion.actual.enunciado)
  while (!terminada(sesion)) {
    await contestarBien(page, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    if (!terminada(sesion)) {
      await page.getByRole('button', { name: 'Siguiente' }).click()
      sesion = avanzar(sesion)
    }
  }
  await page.getByRole('button', { name: 'Ver resultado' }).click()
  await expect(page.getByRole('heading', { name: 'Nivel 5 completo' })).toBeVisible()
  await expect(page.getByText(/Leíste \d+ preguntas en \d+ s/)).toBeVisible()
  await page.getByRole('button', { name: 'Volver a los niveles' }).click()
  await expect(page.getByRole('listitem').last()).toContainText('Mejor:')
})

test('celular: el reto entra en la primera pantalla y las zonas miden al menos 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let sesion = await abrirNivel(page, 'latido')
  while (sesion.actual.respuesta.modo !== 'zona') {
    await contestarBien(page, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    await page.getByRole('button', { name: 'Siguiente' }).click()
    sesion = avanzar(sesion)
  }
  const botones = page
    .getByRole('group', { name: 'Partes del latido para tocar' })
    .getByRole('button')
  await expect(botones).toHaveCount(4)
  for (const boton of await botones.all()) {
    const caja = await boton.boundingBox()
    expect(caja?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(caja?.height ?? 0).toBeGreaterThanOrEqual(44)
  }
  const enunciado = await page.getByRole('heading', { level: 2 }).boundingBox()
  expect(enunciado?.y ?? 9999).toBeLessThan(844)
  await todosLosChequeos(page, 'reto-celular')

  // La tabla de referencias se apila por fila: las 14 filas de datos siguen, sin la de encabezados.
  await page.getByRole('button', { name: 'Niveles' }).click()
  await page.getByRole('button', { name: 'Valores normales y fuentes' }).click()
  await expect(page.getByRole('row')).toHaveCount(14)
  await todosLosChequeos(page, 'referencias-celular')
})

test('sin almacenamiento: la app juega igual y sólo deja de recordar el progreso', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('almacenamiento bloqueado')
      },
    })
  })
  const errores: string[] = []
  page.on('pageerror', (e) => errores.push(e.message))
  const sesion = await abrirNivel(page, 'papel')
  await contestarBien(page, sesion.actual)
  await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText('Bien.')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Entrenador de ECG' })).toBeVisible()
  await expect(page.getByText('Completado')).toHaveCount(0)
  expect(errores).toEqual([])
})

import { expect, test, type Locator, type Page } from '@playwright/test'

import { avanzar, responder, terminada } from '../src/motor/sesion.ts'
import { abrirNivel, contestarBien, contestarMal, todosLosChequeos } from './ayudas.ts'

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
/** Milímetros de papel de una tira de 6 segundos a 25 mm/s. */
const MM_TIRA_6S = 150

/** Espera a que terminen las animaciones (el pulso del trazo agranda la tira un 1,5 %). */
async function sinAnimaciones(page: Page) {
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
  )
}

async function anchoDe(locator: Locator): Promise<number> {
  const caja = await locator.boundingBox()
  expect(caja).not.toBeNull()
  return caja?.width ?? 0
}

for (const { ancho, alto, minimo } of [
  { ancho: 1440, alto: 900, minimo: 9 },
  { ancho: 1366, alto: 650, minimo: 8.5 },
]) {
  test(`escritorio ${ancho} × ${alto}: la tira de 6 s respondida mide al menos ${minimo} px por mm y «Siguiente» entra sin desplazar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: alto })
    for (const bien of [true, false]) {
      const sesion = await abrirNivel(page, 'lectura')
      const reto = sesion.actual
      expect(reto.vista.tipo === 'tira' && reto.vista.tira.duracionMs).toBe(6000)
      const tira = page.getByRole('img', { name: /^Tira de/ })
      const columna = await anchoDe(page.locator('section'))
      // Antes de responder: la tira ya sale de la columna y no hay prueba sobre ella.
      expect(await anchoDe(tira)).toBeGreaterThan(columna)
      await expect(page.locator('[data-evidencia]')).toHaveCount(0)

      await (bien ? contestarBien(page, reto) : contestarMal(page, reto))
      await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText(
        bien ? 'Bien.' : 'No era esa.',
      )
      await sinAnimaciones(page)
      await expect(page.locator('[data-evidencia]')).toHaveCount(reto.evidencia.length)
      expect((await anchoDe(tira)) / MM_TIRA_6S).toBeGreaterThanOrEqual(minimo)
      // Página sin desplazarse ni de costado: «Siguiente» entra entero en la ventana.
      const siguiente = page.getByRole('button', { name: 'Siguiente' })
      await expect(siguiente).toBeFocused()
      await expect(siguiente).toBeInViewport({ ratio: 1 })
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0)
      if (ancho === 1440) await todosLosChequeos(page, bien ? 'ancha-correcta' : 'ancha-incorrecta')
    }
  })
}

test('debajo de 768 px la tira queda en la columna; el latido y el papel nunca salen de ella', async ({
  page,
}) => {
  for (const ancho of [390, 767]) {
    await page.setViewportSize({ width: ancho, height: 900 })
    await abrirNivel(page, 'lectura')
    // El papel lleva 1 px de borde a cada lado.
    expect(await anchoDe(page.getByRole('img', { name: /^Tira de/ }))).toBeCloseTo(
      (await anchoDe(page.locator('section'))) - 2,
      0,
    )
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  let sesion = await abrirNivel(page, 'ritmo')
  expect(sesion.actual.vista.tipo).toBe('latido')
  const columna = await anchoDe(page.locator('section'))
  expect(await anchoDe(page.getByRole('img', { name: /latido/ }))).toBeLessThanOrEqual(columna)
  sesion = await abrirNivel(page, 'papel')
  expect(sesion.actual.vista.tipo).toBe('papel')
  expect(await anchoDe(page.getByRole('img').first())).toBeLessThanOrEqual(columna)
})

test('teclado: el 1 elige la primera opción como un clic y, respondido, los dígitos no hacen nada', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const sesion = await abrirNivel(page, 'lectura')
  const reto = sesion.actual
  if (reto.respuesta.modo !== 'opciones') throw new Error('El primer reto debía tener opciones')
  const opciones = page.getByRole('group', { name: 'Opciones' }).getByRole('button')
  // Con mouse, cada opción muestra su número; el nombre sigue siendo la opción.
  await expect(page.locator('kbd').first()).toBeVisible()
  await expect(page.locator('kbd')).toHaveCount(reto.respuesta.opciones.length)
  await expect(opciones.first()).toHaveAttribute('aria-keyshortcuts', '1')

  await page.keyboard.press('1')
  const primera = reto.respuesta.opciones[0]
  if (!primera) throw new Error('El reto no tiene opciones')
  const bien = primera.id === reto.respuesta.correcta
  await expect(opciones.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status', { name: 'Resultado del reto' })).toContainText(
    bien ? 'Bien.' : 'No era esa.',
  )
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused()
  await expect(page.locator('kbd').first()).toBeHidden()

  // Respondido: otro dígito no cambia la respuesta.
  await page.keyboard.press('2')
  await expect(opciones.first()).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1)
})

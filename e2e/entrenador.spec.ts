import { expect, test, type Locator, type Page } from '@playwright/test'

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

/** Contesta el reto en pantalla (o dentro de `raiz`) con la respuesta que el motor dice que es correcta. */
async function contestarBien(raiz: Page | Locator, reto: Reto) {
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

async function contestarMal(raiz: Page | Locator, reto: Reto) {
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

// ---------------------------------------------------------------------------------------------
// Tira apaisada. Con `?semilla=41` el nivel 3 trae: texto, tira con opciones, tira con contador,
// tira con contador y texto (con un error en el segundo, el cuarto pasa a ser texto).

/**
 * Cada control a la vista mide al menos 44 × 44 px. Se afirma acá porque la medida del kit usa 24 px
 * desde 768 px de ancho y el teléfono apaisado mide 844.
 */
async function controlesDe44(raiz: Locator, estado: string) {
  const controles = raiz.locator('button, a[href], input, select, textarea')
  await expect(controles.first()).toBeVisible()
  for (const control of await controles.all()) {
    if (!(await control.isVisible())) continue
    const caja = await control.boundingBox()
    const nombre = (await control.getAttribute('aria-label')) ?? (await control.textContent())
    expect(caja?.width ?? 0, `${estado}: ancho de «${nombre}»`).toBeGreaterThanOrEqual(44)
    expect(caja?.height ?? 0, `${estado}: alto de «${nombre}»`).toBeGreaterThanOrEqual(44)
  }
}

/** La tira entra entera en la pantalla y la página no se desplaza de costado. */
async function tiraEntera(page: Page, modo: Locator) {
  const vista = page.viewportSize()
  const caja = await modo.getByRole('img', { name: /^Tira de/ }).boundingBox()
  expect(caja).not.toBeNull()
  if (!caja || !vista) return
  expect(caja.x).toBeGreaterThanOrEqual(0)
  expect(caja.y).toBeGreaterThanOrEqual(0)
  expect(caja.x + caja.width).toBeLessThanOrEqual(vista.width)
  expect(caja.y + caja.height).toBeLessThanOrEqual(vista.height)
  const desborde = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(desborde).toBeLessThanOrEqual(0)
}

/** Contesta bien el primer reto (sin tira) del nivel 3 y pasa al segundo, que tiene tira. */
async function hastaLaPrimeraTira(page: Page): Promise<Sesion> {
  let sesion = await abrirNivel(page, 'frecuencia')
  expect(sesion.actual.vista.tipo).toBe('texto')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await contestarBien(page, sesion.actual)
  sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
  await page.getByRole('button', { name: 'Siguiente' }).click()
  sesion = avanzar(sesion)
  expect(sesion.actual.vista.tipo).toBe('tira')
  return sesion
}

test.describe('tira apaisada con el teléfono girado (844 × 390, táctil)', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })

  test('se abre sola en un reto con tira, se responde adentro y se cierra en uno sin tira', async ({
    page,
  }) => {
    // El piso de 44 px en la pantalla de siempre: «Niveles», las opciones.
    await abrirNivel(page, 'frecuencia')
    await controlesDe44(page.locator('main'), 'pantalla-apaisada')
    let sesion = await hastaLaPrimeraTira(page)

    const modo = page.getByRole('dialog')
    await expect(modo).toBeVisible()
    await expect(modo.locator('[data-marco="derecho"]')).toHaveCount(1)
    const titulo = modo.getByRole('heading', { level: 2 })
    await expect(titulo).toHaveText(sesion.actual.enunciado)
    await expect(titulo).toBeFocused()
    await expect(page.getByRole('button', { name: 'Ver la tira apaisada' })).toBeHidden()
    await tiraEntera(page, modo)
    await todosLosChequeos(page, 'apaisada-opciones')
    await controlesDe44(modo, 'apaisada-opciones')

    // Un error: el resultado y «Siguiente» ocupan la franja de la respuesta sin mover la tira.
    const tiraAntes = await modo.getByRole('img', { name: /^Tira de/ }).boundingBox()
    await contestarMal(modo, sesion.actual)
    sesion = responder(sesion, '__mal__').sesion
    const resultado = modo.getByRole('status', { name: 'Resultado del reto' })
    await expect(resultado).toContainText('No era esa.')
    await expect(resultado).toContainText(sesion.actual.error)
    await expect(modo.getByRole('button', { name: 'Siguiente' })).toBeFocused()
    expect(await modo.getByRole('img', { name: /^Tira de/ }).boundingBox()).toEqual(tiraAntes)
    await todosLosChequeos(page, 'apaisada-incorrecta')
    await controlesDe44(modo, 'apaisada-incorrecta')

    // El reto siguiente también tiene tira: el modo sigue abierto, con el foco en el enunciado.
    await page.keyboard.press('Enter')
    sesion = avanzar(sesion)
    expect(sesion.actual.vista.tipo).toBe('tira')
    expect(sesion.actual.respuesta.modo).toBe('conteo')
    await expect(titulo).toHaveText(sesion.actual.enunciado)
    await expect(titulo).toBeFocused()
    await todosLosChequeos(page, 'apaisada-conteo')
    await controlesDe44(modo, 'apaisada-conteo')

    // Un acierto: el trazo late.
    await contestarBien(modo, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    await expect(resultado).toContainText('Bien.')
    await expect(modo.locator('svg.tira-pulso')).toHaveCount(1)
    await todosLosChequeos(page, 'apaisada-correcta')
    await controlesDe44(modo, 'apaisada-correcta')

    // Un reto sin tira cierra el modo y vuelve a la pantalla de siempre.
    await modo.getByRole('button', { name: 'Siguiente' }).click()
    sesion = avanzar(sesion)
    expect(sesion.actual.vista.tipo).not.toBe('tira')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const enunciado = page.getByRole('heading', { level: 2 })
    await expect(enunciado).toHaveText(sesion.actual.enunciado)
    await expect(enunciado).toBeFocused()
    await todosLosChequeos(page, 'apaisada-cerrada-sin-tira')
  })

  test('Escape y «Salir» la cierran; sola vuelve recién después de pasar por la vertical', async ({
    page,
  }) => {
    let sesion = await hastaLaPrimeraTira(page)
    const modo = page.getByRole('dialog')
    const enunciado = page.getByRole('heading', { level: 2 })
    const boton = page.getByRole('button', { name: 'Ver la tira apaisada' })
    await expect(modo).toBeVisible()

    // Escape: el botón no se ve desde 768 px, así que el foco va al enunciado.
    await page.keyboard.press('Escape')
    await expect(modo).toHaveCount(0)
    await expect(enunciado).toBeFocused()

    // Cerrada a pedido, no se vuelve a abrir sola en el reto siguiente con tira.
    await contestarBien(page, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    await page.getByRole('button', { name: 'Siguiente' }).click()
    sesion = avanzar(sesion)
    expect(sesion.actual.vista.tipo).toBe('tira')
    await expect(enunciado).toHaveText(sesion.actual.enunciado)
    await expect(modo).toHaveCount(0)

    // A la vertical: aparece el botón. De vuelta a apaisada: se abre sola.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(boton).toBeVisible()
    await expect(modo).toHaveCount(0)
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(modo).toBeVisible()
    await expect(modo.getByRole('heading', { level: 2 })).toBeFocused()

    // Abierta sola, se cierra al volver a la vertical y el foco queda en el botón.
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(modo).toHaveCount(0)
    await expect(boton).toBeFocused()

    // «Salir» también la cierra.
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(modo).toBeVisible()
    await modo.getByRole('button', { name: 'Salir' }).click()
    await expect(modo).toHaveCount(0)
    await expect(enunciado).toBeFocused()
  })
})

test.describe('tira apaisada girada en el celular en vertical (390 × 844, táctil)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('el botón la abre girada; se responde adentro y Escape y «Salir» devuelven el foco al botón', async ({
    page,
  }) => {
    const boton = page.getByRole('button', { name: 'Ver la tira apaisada' })
    await abrirNivel(page, 'frecuencia')
    // Sin tira, sin botón.
    await expect(boton).toHaveCount(0)
    let sesion = await hastaLaPrimeraTira(page)
    await expect(boton).toBeVisible()
    await controlesDe44(page.locator('main'), 'retrato-con-boton')
    await todosLosChequeos(page, 'retrato-con-boton')

    await boton.click()
    const modo = page.getByRole('dialog')
    await expect(modo).toBeVisible()
    await expect(modo.locator('[data-marco="girado"]')).toHaveCount(1)
    const titulo = modo.getByRole('heading', { level: 2 })
    await expect(titulo).toBeFocused()
    // Girada: la tira queda a lo largo de la pantalla.
    const caja = await modo.getByRole('img', { name: /^Tira de/ }).boundingBox()
    expect(caja?.height ?? 0).toBeGreaterThan((caja?.width ?? 0) * 3)
    await tiraEntera(page, modo)
    await todosLosChequeos(page, 'girada-opciones')
    await controlesDe44(modo, 'girada-opciones')

    await contestarBien(modo, sesion.actual)
    sesion = responder(sesion, sesion.actual.respuesta.correcta).sesion
    const resultado = modo.getByRole('status', { name: 'Resultado del reto' })
    await expect(resultado).toContainText('Bien.')
    await expect(resultado).toContainText(sesion.actual.acierto)
    await expect(modo.locator('svg.tira-pulso')).toHaveCount(1)
    await expect(modo.getByRole('button', { name: 'Siguiente' })).toBeFocused()
    await todosLosChequeos(page, 'girada-correcta')
    await controlesDe44(modo, 'girada-correcta')

    await modo.getByRole('button', { name: 'Siguiente' }).click()
    sesion = avanzar(sesion)
    expect(sesion.actual.respuesta.modo).toBe('conteo')
    await expect(titulo).toHaveText(sesion.actual.enunciado)
    await expect(titulo).toBeFocused()
    await todosLosChequeos(page, 'girada-conteo')
    await controlesDe44(modo, 'girada-conteo')

    await contestarMal(modo, sesion.actual)
    await expect(resultado).toContainText('No era esa.')
    await todosLosChequeos(page, 'girada-incorrecta')
    await controlesDe44(modo, 'girada-incorrecta')

    await page.keyboard.press('Escape')
    await expect(modo).toHaveCount(0)
    await expect(boton).toBeFocused()

    // Ya respondido: se reabre con el resultado y «Siguiente»; «Salir» la cierra.
    await boton.click()
    await expect(modo).toBeVisible()
    await expect(resultado).toContainText('No era esa.')
    await modo.getByRole('button', { name: 'Salir' }).click()
    await expect(modo).toHaveCount(0)
    await expect(boton).toBeFocused()
  })
})

test('escritorio: la tira apaisada no aparece y los botones conservan su alto', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await hastaLaPrimeraTira(page)
  await expect(page.getByRole('img', { name: /^Tira de/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ver la tira apaisada' })).toBeHidden()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Con mouse desde 768 px, el Button copiado mantiene sus tamaños de escritorio.
  const niveles = await page.getByRole('button', { name: 'Niveles' }).boundingBox()
  expect(niveles?.height).toBe(28)
})

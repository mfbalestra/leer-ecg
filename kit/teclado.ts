import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

type IndicadorDeFoco = { estado: 'pass' | 'fail' | 'n/a'; detalle: string }

declare global {
  interface Window {
    prepararMedidaDeFoco: (documento: Document) => void
    medirIndicadorDeFoco: (documento: Document) => IndicadorDeFoco
    terminarMedidaDeFoco: (documento: Document) => void
  }
}

type Control = { i: number; nombre: string; estado: string | null }
type Compuesto = {
  c: number
  nombre: string
  rol: string | null
  itemTabulable: number
  entrada: boolean
  descendienteActivo: boolean
}
type Mapa = {
  controles: Control[]
  compuestos: Compuesto[]
  sinParada: string[]
  enDialogo: boolean
}

/**
 * Maneja el teclado de verdad sobre el estado actual de la página y falla si algo no se puede usar
 * sin mouse. Se llama en cada estado relevante, junto a `axeSinViolaciones`: axe no ve un `div`
 * clickeable sin teclado ni un widget cuyas flechas no hacen nada. Con un diálogo abierto, el barrido
 * se limita a él. Al terminar deja la página como la encontró: cierra lo que abrió, repite la tecla
 * que marcó algo y devuelve el foco. Tabular fuera de un popup abierto (una lista, un menú) lo cierra,
 * como le pasaría a una persona: en un estado cuyo paso siguiente necesita el popup abierto, llamarlo
 * después de ese paso o volver a abrir el popup. En el mismo recorrido con Tab mide el indicador de
 * foco de cada control con `medir-oficio.js`: falla si no se ve o si queda por debajo de 3:1 contra el
 * fondo que lo rodea. No verifica el orden lógico del foco, las trampas de foco ni los
 * atajos: eso sigue en el recorrido de `implementar-interfaz`.
 */
export async function tecladoSinFallas(page: Page, estado: string) {
  const mapa = await page.evaluate(marcarControles)
  const problemas: string[] = []
  // Un control que no vuelve a su estado tras la prueba puede ser correcto (no todo es un interruptor
  // simétrico): se anota como aviso, no como falla, para que la persona revise el paso siguiente.
  const avisos: string[] = []
  try {
    for (const nombre of mapa.sinParada) {
      problemas.push(`sin parada de tabulación: ${nombre} tiene rol interactivo y ningún tabindex`)
    }
    const recorrido = await recorrerConTab(page, mapa.controles)
    for (const nombre of recorrido.inalcanzables) {
      problemas.push(
        `inalcanzable con Tab${mapa.enDialogo ? ' (dentro del diálogo)' : ''}: ${nombre}`,
      )
    }
    for (const detalle of recorrido.focoInsuficiente) problemas.push(`foco: ${detalle}`)
    for (const control of mapa.controles.filter((x) => x.estado)) {
      if (!(await respondeAEnterOEspacio(page, control, avisos))) {
        problemas.push(
          `tecla muerta: ${control.nombre} expone ${control.estado} y no cambia con Enter ni Espacio`,
        )
      }
    }
    for (const compuesto of mapa.compuestos) {
      const problema = await revisarCompuesto(page, compuesto, avisos)
      if (problema) problemas.push(problema)
    }
  } finally {
    await page.evaluate(restaurarFoco)
  }
  test.info().annotations.push({
    type: `teclado:${estado}`,
    description: `${mapa.controles.length} control(es), ${mapa.compuestos.length} compuesto(s); ${
      problemas.join('; ') || 'sin problemas'
    }${avisos.length ? `; avisos: ${avisos.join('; ')}` : ''}`,
  })
  expect(problemas, `teclado en estado "${estado}": ${problemas.join('; ')}`).toEqual([])
}

const esperar = (page: Page) => page.waitForTimeout(60)
const PARES_DE_FLECHAS: [string, string][] = [
  ['ArrowDown', 'ArrowUp'],
  ['ArrowRight', 'ArrowLeft'],
]
const selector = (i: number) => `[data-teclado-i="${i}"]`

// Una vuelta con Tab: anota a qué controles se llega y, en cada parada, el indicador de foco.
async function recorrerConTab(page: Page, controles: Control[]) {
  if (controles.length === 0) return { inalcanzables: [], focoInsuficiente: [] }
  await page.addScriptTag({ path: fileURLToPath(new URL('./medir-oficio.js', import.meta.url)) })
  await page.evaluate(() => {
    ;(document.activeElement as HTMLElement | null)?.blur()
    window.prepararMedidaDeFoco(document)
  })
  const alcanzados = new Set<number>()
  const focoPorControl = new Map<number, string>()
  // Por dónde pasó el foco: si algo queda inalcanzable, distingue un control que se volvió a montar
  // (perdió su marca) de un foco que quedó fuera del ciclo del diálogo.
  const recorrido: string[] = []
  const presupuesto = controles.length * 3 + 20
  try {
    for (let k = 0; k < presupuesto && alcanzados.size < controles.length; k++) {
      await page.keyboard.press('Tab')
      const parada = await page.evaluate(() => {
        const el = document.activeElement
        return {
          i: el?.getAttribute('data-teclado-i') ?? null,
          paso: el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}` : 'nada',
          foco: window.medirIndicadorDeFoco(document),
        }
      })
      if (recorrido.length < 40) recorrido.push(`${parada.paso}[${parada.i ?? '-'}]`)
      if (parada.i === null) continue
      alcanzados.add(Number(parada.i))
      if (parada.foco.estado === 'fail') focoPorControl.set(Number(parada.i), parada.foco.detalle)
    }
  } finally {
    await page.evaluate(() => window.terminarMedidaDeFoco(document))
  }
  return {
    inalcanzables: controles
      .filter((x) => !alcanzados.has(x.i))
      .map((x) => `${x.nombre} (recorrido: ${recorrido.join(' ')})`),
    focoInsuficiente: [...focoPorControl.values()],
  }
}

async function respondeAEnterOEspacio(page: Page, control: Control, avisos: string[]) {
  const atributo = control.estado as string
  const leer = () => page.getAttribute(selector(control.i), atributo)
  for (const tecla of ['Enter', 'Space']) {
    await page.focus(selector(control.i)).catch(() => undefined)
    const antes = await leer()
    await page.keyboard.press(tecla)
    await esperar(page)
    const despues = await leer()
    if (antes === despues) continue
    if (atributo === 'aria-expanded' && despues === 'true') {
      await page.keyboard.press('Escape')
      await esperar(page)
    }
    if (atributo !== 'aria-selected' && (await leer()) !== antes) {
      await page.focus(selector(control.i)).catch(() => undefined)
      await page.keyboard.press(tecla)
      await esperar(page)
    }
    const final = await leer()
    if (final !== antes) {
      avisos.push(`${control.nombre} quedó con ${atributo}="${final}" (antes "${antes}")`)
    }
    return true
  }
  return false
}

async function revisarCompuesto(page: Page, compuesto: Compuesto, avisos: string[]) {
  if (!compuesto.entrada) {
    return `widget sin entrada: ${compuesto.nombre} (${compuesto.rol}) no tiene ítem, contenedor ni dueño tabulable`
  }
  if (compuesto.descendienteActivo) {
    const anfitrion = `[data-teclado-ad="${compuesto.c}"]`
    const leer = () => page.getAttribute(anfitrion, 'aria-activedescendant')
    const expandido = () => page.getAttribute(anfitrion, 'aria-expanded')
    await page.focus(anfitrion).catch(() => undefined)
    const antes = await leer()
    const expandidoAntes = await expandido()
    let movio = false
    for (const [tecla, vuelta] of PARES_DE_FLECHAS) {
      await page.keyboard.press(tecla)
      await esperar(page)
      if ((await leer()) !== antes) {
        movio = true
        await page.keyboard.press(vuelta)
        await esperar(page)
        break
      }
    }
    if ((await expandido()) === 'true' && expandidoAntes !== 'true')
      await page.keyboard.press('Escape')
    const final = await leer()
    if (movio && final !== antes) {
      avisos.push(
        `${compuesto.nombre} quedó con aria-activedescendant="${final}" (antes "${antes}")`,
      )
    }
    return movio
      ? null
      : `flechas muertas: ${compuesto.nombre} usa aria-activedescendant y las flechas no lo mueven`
  }
  if (compuesto.itemTabulable < 0) return null
  const inicio = `${compuesto.c}.${compuesto.itemTabulable}`
  const enfocado = () =>
    page.evaluate(() => document.activeElement?.getAttribute('data-teclado-item') ?? null)
  for (const [tecla, vuelta] of PARES_DE_FLECHAS) {
    await page.focus(`[data-teclado-item="${inicio}"]`).catch(() => undefined)
    await page.keyboard.press(tecla)
    await esperar(page)
    const ahora = await enfocado()
    if (ahora && ahora !== inicio) {
      await page.keyboard.press(vuelta)
      await esperar(page)
      if ((await enfocado()) !== inicio) {
        avisos.push(`${compuesto.nombre} no volvió al ítem inicial con ${vuelta}`)
      }
      return null
    }
  }
  return `flechas muertas: ${compuesto.nombre} (${compuesto.rol}) tiene tabindex itinerante y las flechas no mueven el foco`
}

// Corre en el navegador: marca controles y compuestos con atributos `data-teclado-*`.
function marcarControles(): Mapa {
  const NATIVOS = /^(a|button|input|select|textarea|summary)$/
  const CONTROLES =
    'a[href],button,input:not([type="hidden"]),select,textarea,summary,[role="button"],' +
    '[role="link"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="menuitem"],' +
    '[role="menuitemcheckbox"],[role="option"],[tabindex]'
  const COMPUESTOS =
    '[role="tablist"],[role="listbox"],[role="tree"],[role="grid"],[role="menu"],[role="menubar"],' +
    '[role="radiogroup"],[role="toolbar"]'
  const ITEMS =
    '[role="tab"],[role="option"],[role="treeitem"],[role="menuitem"],[role="menuitemcheckbox"],' +
    '[role="menuitemradio"],[role="radio"],[role="gridcell"],[role="row"],button,a[href]'
  const INDEPENDIENTES = ['button', 'link', 'checkbox', 'switch']
  const ESTADOS = ['aria-checked', 'aria-expanded', 'aria-pressed', 'aria-selected']

  for (const el of document.querySelectorAll(
    '[data-teclado-i],[data-teclado-item],[data-teclado-ad]',
  )) {
    el.removeAttribute('data-teclado-i')
    el.removeAttribute('data-teclado-item')
    el.removeAttribute('data-teclado-ad')
  }
  document.querySelector('[data-teclado-previo]')?.removeAttribute('data-teclado-previo')
  document.activeElement?.setAttribute('data-teclado-previo', '')

  const visible = (el: Element) => {
    // Lo inerte (una vista previa, el fondo de un modal) no recibe foco ni eventos: no es una parada.
    if (el.closest('[inert]')) return false
    const estilo = getComputedStyle(el)
    if (estilo.display === 'none' || estilo.visibility === 'hidden' || Number(estilo.opacity) === 0)
      return false
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility()) return false
    // Lo oculto con la técnica de 1px es para lectores de pantalla, no una parada de teclado.
    const caja = el.getBoundingClientRect()
    return caja.width > 1 && caja.height > 1
  }
  const operable = (el: Element) =>
    !(el as HTMLButtonElement).disabled &&
    el.getAttribute('aria-disabled') !== 'true' &&
    getComputedStyle(el).pointerEvents !== 'none'
  const tabulable = (el: Element) => {
    const indice = el.getAttribute('tabindex')
    if (indice !== null) return Number(indice) >= 0
    return NATIVOS.test(el.tagName.toLowerCase())
  }
  const nombre = (el: Element) => {
    const texto = (el.getAttribute('aria-label') || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
    const id = el.id ? `#${el.id}` : ''
    return `${el.tagName.toLowerCase()}${id}${texto ? ` "${texto.slice(0, 28)}"` : ''}`
  }

  const dialogo = [
    ...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog'),
  ].find(visible)
  const raiz = dialogo ?? document.body

  // Un grupo de radios nativos deja una sola parada de Tab; las demás se recorren con flechas.
  const radiosSinParada = () => {
    const fuera = new Set<Element>()
    for (const radio of raiz.querySelectorAll<HTMLInputElement>('input[type="radio"][name]')) {
      const grupo = [
        ...raiz.querySelectorAll<HTMLInputElement>(
          `input[type="radio"][name="${CSS.escape(radio.name)}"]`,
        ),
      ].filter((el) => visible(el) && !el.disabled)
      const parada = grupo.find((el) => el.checked) ?? grupo[0]
      if (grupo.length > 1) for (const el of grupo) if (el !== parada) fuera.add(el)
    }
    return fuera
  }

  // Lo ya seleccionado no se juzga: Enter no tiene a dónde cambiarlo. Tampoco el radio ya marcado, que según el
  // patrón de radios no se desmarca con Espacio; una casilla marcada sí se juzga.
  const estadoJuzgable = (el: Element) => {
    if (NATIVOS.test(el.tagName.toLowerCase())) return null
    const yaElegido = (a: string) =>
      (a === 'aria-selected' && el.getAttribute(a) !== 'false') ||
      (a === 'aria-checked' && el.getAttribute('role') === 'radio' && el.getAttribute(a) === 'true')
    const juzgable = (a: string) => el.hasAttribute(a) && !yaElegido(a)
    return ESTADOS.find(juzgable) ?? null
  }

  const sinParadaDeTab = (el: Element) => {
    const rol = el.getAttribute('role')
    return el.getAttribute('tabindex') === null && rol !== null && INDEPENDIENTES.includes(rol)
  }

  const marcarTabulables = () => {
    const fuera = radiosSinParada()
    const controles: Control[] = []
    const sinParada: string[] = []
    for (const el of raiz.querySelectorAll(CONTROLES)) {
      if (fuera.has(el) || !visible(el) || !operable(el)) continue
      if (!tabulable(el)) {
        if (sinParadaDeTab(el)) sinParada.push(nombre(el))
        continue
      }
      const i = controles.length
      el.setAttribute('data-teclado-i', String(i))
      controles.push({ i, nombre: nombre(el), estado: estadoJuzgable(el) })
    }
    return { controles, sinParada }
  }

  const duenoDe = (caja: Element) => {
    if (!caja.id) return undefined
    const id = CSS.escape(caja.id)
    return [...document.querySelectorAll(`[aria-controls~="${id}"],[aria-owns~="${id}"]`)].find(
      (el) => visible(el) && tabulable(el),
    )
  }

  const anfitrionDe = (caja: Element, dueno: Element | undefined) => {
    if (dueno?.hasAttribute('aria-activedescendant')) return dueno
    return caja.hasAttribute('aria-activedescendant') ? caja : undefined
  }

  // Los popups (listas, menús) suelen dibujarse fuera del diálogo que los abre: se buscan en todo el
  // documento, pero con un diálogo abierto sólo cuentan los de adentro y los que pertenecen a un
  // control de adentro; lo que quedó detrás del diálogo no se barre.
  const enAlcance = (caja: Element, dueno: Element | undefined) =>
    !dialogo || dialogo.contains(caja) || Boolean(dueno && dialogo.contains(dueno))

  const marcarCompuestos = () => {
    const compuestos: Compuesto[] = []
    for (const caja of document.querySelectorAll(COMPUESTOS)) {
      const items = [...caja.querySelectorAll(ITEMS)].filter((el) => visible(el) && operable(el))
      const dueno = duenoDe(caja)
      if (!visible(caja) || items.length < 2 || !enAlcance(caja, dueno)) continue
      const c = compuestos.length
      items.forEach((el, k) => el.setAttribute('data-teclado-item', `${c}.${k}`))
      const anfitrion = anfitrionDe(caja, dueno)
      anfitrion?.setAttribute('data-teclado-ad', String(c))
      const itemTabulable = items.findIndex(tabulable)
      compuestos.push({
        c,
        nombre: nombre(caja),
        rol: caja.getAttribute('role'),
        itemTabulable,
        entrada: itemTabulable >= 0 || tabulable(caja) || Boolean(dueno),
        descendienteActivo: Boolean(anfitrion),
      })
    }
    return compuestos
  }

  const { controles, sinParada } = marcarTabulables()
  return { controles, compuestos: marcarCompuestos(), sinParada, enDialogo: Boolean(dialogo) }
}

// Corre en el navegador: devuelve el foco a quien lo tenía y borra las marcas.
function restaurarFoco() {
  const previo = document.querySelector<HTMLElement>('[data-teclado-previo]')
  if (previo && previo !== document.body) previo.focus()
  else (document.activeElement as HTMLElement | null)?.blur()
  for (const el of document.querySelectorAll(
    '[data-teclado-i],[data-teclado-item],[data-teclado-ad]',
  )) {
    el.removeAttribute('data-teclado-i')
    el.removeAttribute('data-teclado-item')
    el.removeAttribute('data-teclado-ad')
  }
  previo?.removeAttribute('data-teclado-previo')
}

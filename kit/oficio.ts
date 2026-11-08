import { fileURLToPath } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

import { evaluarOficioConocidas, rompeOficioConocidas } from './oficio-conocidas.ts'

type EstadoMedida = 'pass' | 'fail' | 'n/a'
type MedidaOficio = {
  id: string
  estado: EstadoMedida
  valor: unknown
  detalle: string
}
type ResultadoOficio = {
  ok: boolean
  mensaje?: string
  vista?: { ancho: number; alto: number }
  medidas: MedidaOficio[]
}

declare global {
  interface Window {
    medirOficio: (documento: Document, opciones: unknown) => ResultadoOficio
  }
}

/**
 * Mide el piso de oficio visual (`medir-oficio.js`) sobre el estado actual de la página y falla
 * ante cualquier medida en `fail`. Se llama en cada estado relevante, junto a `axeSinViolaciones`.
 * Sin `conocidas`, el comportamiento es el de siempre: cualquier medida en `fail` rompe. Con
 * `conocidas`, sólo rompen las fallas no listadas, una conocida que pasó a `pass` o a `n/a` (hay que
 * sacarla de la lista) o un ID conocido que no aparece entre las medidas de este estado.
 */
export async function oficioSinFallas(
  page: Page,
  estado: string,
  opciones: {
    acento?: string
    estrategia?: 'restrained' | 'committed' | 'full-palette' | 'drenched'
    conocidas?: string[]
  } = {},
) {
  const { conocidas, ...opcionesMedicion } = opciones
  await page.addScriptTag({
    path: fileURLToPath(new URL('./medir-oficio.js', import.meta.url)),
  })
  const resultado = await page.evaluate(
    (opcionesPagina) => window.medirOficio(document, opcionesPagina),
    opcionesMedicion,
  )
  if (!resultado.ok) {
    expect(resultado.ok, resultado.mensaje ?? 'medirOficio no pudo correr').toBe(true)
    return
  }
  const noMedibles = resultado.medidas.filter((m) => m.estado === 'n/a')
  test.info().annotations.push({
    type: `oficio:${estado}`,
    description: `vista ${resultado.vista?.ancho}x${resultado.vista?.alto}; n/a: ${
      noMedibles.map((m) => `${m.id} (${m.detalle})`).join('; ') || 'ninguna'
    }`,
  })
  if (!conocidas) {
    const fallas = resultado.medidas.filter((m) => m.estado === 'fail')
    const mensaje = fallas.map((m) => `${m.id}=${String(m.valor)} (${m.detalle})`).join('; ')
    expect(fallas, `oficio en estado "${estado}": ${mensaje}`).toEqual([])
    return
  }
  const rotura = evaluarOficioConocidas(resultado.medidas, conocidas)
  const mensaje = [
    rotura.fallasNoConocidas.length > 0 &&
      `no conocidas: ${rotura.fallasNoConocidas.map((m) => `${m.id}=${String(m.valor)}`).join(', ')}`,
    rotura.conocidasQuePasan.length > 0 &&
      `conocidas que ya pasan: ${rotura.conocidasQuePasan.join(', ')}`,
    rotura.conocidasInexistentes.length > 0 &&
      `conocidas inexistentes: ${rotura.conocidasInexistentes.join(', ')}`,
    rotura.conocidasNoMedibles.length > 0 &&
      `conocidas no medibles: ${rotura.conocidasNoMedibles.join(', ')}`,
  ]
    .filter(Boolean)
    .join('; ')
  expect(rompeOficioConocidas(rotura), `oficio en estado "${estado}": ${mensaje}`).toBe(false)
}

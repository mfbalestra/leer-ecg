import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

/**
 * Corre axe sobre el estado actual de la página y falla ante cualquier violación WCAG 2.1 A/AA.
 * Se llama en cada estado relevante (diálogo abierto, lista desplegada, formulario con errores,
 * tabla vacía o en error, confirmación abierta), no sólo al cargar. Un resultado limpio no acredita
 * accesibilidad completa: el tab manual y la inspección visual siguen en `implementar-interfaz`.
 * Antes de medir espera hasta 2 s las transiciones de CSS en curso: a mitad de un cambio de color, axe
 * mide un contraste que el estado final no tiene.
 */
export async function axeSinViolaciones(page: Page, estado: string) {
  await page.evaluate(async () => {
    const enCurso = document
      .getAnimations()
      .filter((a) => a instanceof CSSTransition && a.playState === 'running')
    await Promise.race([
      Promise.all(enCurso.map((a) => a.finished.catch(() => undefined))),
      new Promise((listo) => setTimeout(listo, 2000)),
    ])
  })
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  const resumen = resultado.violations.map(
    (v) => `${v.id} (${v.impact ?? 'sin impacto'}) x${v.nodes.length}`,
  )
  test.info().annotations.push({
    type: `axe:${estado}`,
    description: resumen.join('; ') || 'sin violaciones',
  })
  expect(resultado.violations, `axe en estado "${estado}": ${resumen.join('; ')}`).toEqual([])
}

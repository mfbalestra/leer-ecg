import * as fc from 'fast-check'
import { describe, it } from 'vitest'

// Ejemplo del kit: reemplazalo por la primera prueba por propiedades real del proyecto.
function colapsarEspacios(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

// Entradas sucias a propósito: bordes, tabulaciones, saltos y letras con tilde.
const textos = fc.string({ unit: fc.constantFrom('a', 'á', ' ', '\t', '\n') })

describe('colapsarEspacios', () => {
  it('aplicada dos veces da lo mismo que una', () => {
    fc.assert(
      fc.property(textos, (texto) => {
        const una = colapsarEspacios(texto)
        return colapsarEspacios(una) === una
      }),
    )
  })

  it('no deja espacios en los bordes ni dos seguidos', () => {
    fc.assert(
      fc.property(textos, (texto) => {
        const resultado = colapsarEspacios(texto)
        return resultado === resultado.trim() && !/\s{2}/.test(resultado)
      }),
    )
  })
})

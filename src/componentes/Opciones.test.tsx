import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Opciones } from './Opciones'

const OPCIONES = [
  { id: 'a', etiqueta: 'Primera' },
  { id: 'b', etiqueta: 'Segunda' },
  { id: 'c', etiqueta: 'Tercera' },
]

/** Como la pantalla del nivel: elegir resuelve el reto y apaga los atajos. */
function Reto({ onElegir, atajos = true }: { onElegir: (id: string) => void; atajos?: boolean }) {
  const [elegida, setElegida] = useState<string | null>(null)
  return (
    <>
      <input aria-label="Nota" />
      <Opciones
        opciones={OPCIONES}
        elegida={elegida}
        correcta={elegida === null ? null : 'b'}
        onElegir={(id) => {
          onElegir(id)
          setElegida(id)
        }}
        atajos={atajos}
      />
    </>
  )
}

describe('Opciones: atajos de teclado', () => {
  it('la tecla 2 elige la segunda opción, como un clic', async () => {
    const onElegir = vi.fn()
    render(<Reto onElegir={onElegir} />)
    await userEvent.keyboard('2')
    expect(onElegir).toHaveBeenCalledExactlyOnceWith('b')
    expect(screen.getByRole('button', { name: 'Segunda' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('respondido el reto, los dígitos no hacen nada', async () => {
    const onElegir = vi.fn()
    render(<Reto onElegir={onElegir} />)
    await userEvent.keyboard('1')
    await userEvent.keyboard('3')
    expect(onElegir).toHaveBeenCalledExactlyOnceWith('a')
  })

  it('con el foco en un campo de texto, el dígito se escribe y no elige', async () => {
    const onElegir = vi.fn()
    render(<Reto onElegir={onElegir} />)
    await userEvent.click(screen.getByRole('textbox', { name: 'Nota' }))
    await userEvent.keyboard('1')
    expect(onElegir).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Nota' })).toHaveValue('1')
  })

  it('una tecla sin opción, o con Ctrl, no elige', async () => {
    const onElegir = vi.fn()
    render(<Reto onElegir={onElegir} />)
    await userEvent.keyboard('4')
    await userEvent.keyboard('{Control>}1{/Control}')
    expect(onElegir).not.toHaveBeenCalled()
  })

  it('sin atajos (la vista que no se ve), los dígitos no eligen y no hay número', async () => {
    const onElegir = vi.fn()
    render(<Reto onElegir={onElegir} atajos={false} />)
    await userEvent.keyboard('1')
    expect(onElegir).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Primera' })).not.toHaveAttribute('aria-keyshortcuts')
  })

  it('con seis opciones, como la regla del 300, todas llevan número y la tecla 6 elige la sexta', async () => {
    const seis = ['150', '100', '75', '60', '50', '300'].map((id) => ({
      id,
      etiqueta: `${id} lpm`,
    }))
    const onElegir = vi.fn()
    render(<Opciones opciones={seis} elegida={null} correcta={null} onElegir={onElegir} atajos />)
    seis.forEach((opcion, i) => {
      expect(screen.getByRole('button', { name: opcion.etiqueta })).toHaveAttribute(
        'aria-keyshortcuts',
        String(i + 1),
      )
    })
    await userEvent.keyboard('6')
    expect(onElegir).toHaveBeenCalledExactlyOnceWith('300')
  })

  it('el número no cambia el nombre de la opción y anuncia su atajo', () => {
    render(<Reto onElegir={vi.fn()} />)
    const primera = screen.getByRole('button', { name: 'Primera' })
    expect(primera).toHaveAttribute('aria-keyshortcuts', '1')
  })
})

import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Contador } from './Contador'

function Prueba({ inicial, max }: { inicial: number; max: number }) {
  const [v, setV] = useState(inicial)
  return <Contador etiqueta="Regresan" ariaLabel="Regresan" valor={v} min={0} max={max} onChange={setV} />
}

describe('contador del cierre', () => {
  it('se puede vaciar y escribir 1 sin que quede 10', () => {
    render(<Prueba inicial={0} max={12} />)
    const campo = screen.getByLabelText('Regresan') as HTMLInputElement
    fireEvent.change(campo, { target: { value: '' } })
    expect(campo.value).toBe('')
    fireEvent.change(campo, { target: { value: '1' } })
    expect(campo.value).toBe('1')
    fireEvent.blur(campo)
    expect(campo.value).toBe('1')
  })

  it('no pasa del máximo y los botones suman y restan', () => {
    render(<Prueba inicial={2} max={3} />)
    const campo = screen.getByLabelText('Regresan') as HTMLInputElement
    fireEvent.change(campo, { target: { value: '30' } })
    expect(campo.value).toBe('3')
    fireEvent.click(screen.getByLabelText('Menos: Regresan'))
    expect(campo.value).toBe('2')
    fireEvent.click(screen.getByLabelText('Más: Regresan'))
    expect(campo.value).toBe('3')
  })
})

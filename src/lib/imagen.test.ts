import { describe, expect, it } from 'vitest'
import { escalaPara, extensionDeTipo } from './imagen'

describe('imagen', () => {
  it('reduce una foto grande para que su lado mayor sea el máximo', () => {
    expect(escalaPara(4000, 3000, 1600)).toBe(0.4)
    expect(escalaPara(3000, 4000, 480)).toBeCloseTo(0.12)
  })
  it('nunca agranda una imagen pequeña', () => {
    expect(escalaPara(800, 600, 1600)).toBe(1)
  })
  it('elige la extensión según el tipo real del archivo', () => {
    expect(extensionDeTipo('image/webp')).toBe('webp')
    expect(extensionDeTipo('image/jpeg')).toBe('jpg')
    expect(extensionDeTipo('image/png')).toBe('png')
  })
})

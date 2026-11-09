import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { borrarArchivo, guardarArchivo } from '@/lib/archivos'

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}))

describe('guardarArchivo', () => {
  beforeEach(() => {
    vi.mocked(mkdir).mockReset()
    vi.mocked(writeFile).mockReset()
  })

  test('devuelve una URL dentro de /uploads/ y de la carpeta que se le pidió', async () => {
    const url = await guardarArchivo('complejos/abc', new File(['x'], 'foto.png'))
    expect(url.startsWith('/uploads/complejos/abc/')).toBe(true)
    expect(url.endsWith('.png')).toBe(true)
  })

  test('le pone un nombre nuevo a cada archivo, así dos "foto.png" no se pisan', async () => {
    const primera = await guardarArchivo('usuarios/1', new File(['x'], 'foto.png'))
    const segunda = await guardarArchivo('usuarios/1', new File(['y'], 'foto.png'))
    expect(primera).not.toBe(segunda)
  })

  test('un archivo sin extensión se guarda como .jpg', async () => {
    const url = await guardarArchivo('usuarios/1', new File(['x'], 'sin-extension'))
    expect(url.endsWith('.jpg')).toBe(true)
  })

  test('crea la carpeta antes de escribir', async () => {
    await guardarArchivo('tickets/7', new File(['x'], 'foto.png'))
    expect(mkdir).toHaveBeenCalled()
    expect(writeFile).toHaveBeenCalled()
  })
})

describe('borrarArchivo', () => {
  beforeEach(() => {
    vi.mocked(unlink).mockReset()
  })

  test('no toca nada con una foto que no es nuestra (las del seed)', async () => {
    await borrarArchivo('https://images.unsplash.com/photo-1?w=256')
    expect(unlink).not.toHaveBeenCalled()
  })

  test('borra un archivo nuestro', async () => {
    await borrarArchivo('/uploads/usuarios/1/foto.jpg')
    expect(unlink).toHaveBeenCalled()
  })

  test('si el borrado falla, no tira error', async () => {
    vi.mocked(unlink).mockRejectedValue(new Error('no existe'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(borrarArchivo('/uploads/usuarios/1/foto.jpg')).resolves.toBeUndefined()
  })
})

import { describe, expect, test } from 'vitest'
import { jugadoresFaltantes, normalizarJugadores, textoJugadoresFaltantes } from './jugadores'

describe('normalizarJugadores', () => {
  test('null se mantiene como completa', () => {
    expect(normalizarJugadores('FUTBOL_5', null)).toBe(null)
  })

  test('un número menor al máximo queda como incompleta', () => {
    expect(normalizarJugadores('FUTBOL_5', 6)).toBe(6)
  })

  test('al llegar al máximo o más, queda completa (null)', () => {
    expect(normalizarJugadores('FUTBOL_5', 10)).toBe(null)
    expect(normalizarJugadores('FUTBOL_5', 15)).toBe(null)
  })

  test('nunca guarda menos de 1', () => {
    expect(normalizarJugadores('FUTBOL_5', 0)).toBe(1)
    expect(normalizarJugadores('FUTBOL_5', -3)).toBe(1)
  })
})

describe('jugadoresFaltantes', () => {
  test('completa (null) no falta nadie', () => {
    expect(jugadoresFaltantes('FUTBOL_7', null)).toBe(0)
  })

  test('cuenta los que faltan según el deporte', () => {
    expect(jugadoresFaltantes('FUTBOL_7', 10)).toBe(4)
    expect(jugadoresFaltantes('PADEL', 3)).toBe(1)
  })

  test('nunca es negativo', () => {
    expect(jugadoresFaltantes('FUTBOL_5', 12)).toBe(0)
  })
})

describe('textoJugadoresFaltantes', () => {
  test('completa no muestra texto', () => {
    expect(textoJugadoresFaltantes('FUTBOL_5', null)).toBe(null)
    expect(textoJugadoresFaltantes('FUTBOL_5', 10)).toBe(null)
  })

  test('singular cuando falta uno', () => {
    expect(textoJugadoresFaltantes('PADEL', 3)).toBe('Falta 1 jugador para completar')
  })

  test('plural cuando faltan varios', () => {
    expect(textoJugadoresFaltantes('FUTBOL_5', 6)).toBe('Faltan 4 jugadores para completar')
  })
})

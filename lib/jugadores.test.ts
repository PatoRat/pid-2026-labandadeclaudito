import { describe, expect, test } from 'vitest'
import {
  esIncompleta,
  jugadoresFaltantes,
  normalizarJugadores,
  sumarJugadores,
  textoCupo,
  textoJugadoresFaltantes,
} from './jugadores'

describe('normalizarJugadores', () => {
  test('null se mantiene como completa', () => {
    expect(normalizarJugadores('FUTBOL_5', null)).toBe(null)
  })

  test('un número menor al máximo queda como incompleta', () => {
    expect(normalizarJugadores('FUTBOL_5', 6)).toBe(6)
  })

  test('acota al máximo (guarda el número, no null)', () => {
    expect(normalizarJugadores('FUTBOL_5', 10)).toBe(10)
    expect(normalizarJugadores('FUTBOL_5', 15)).toBe(10)
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

describe('textoCupo', () => {
  test('completa (null) muestra el máximo sobre el máximo', () => {
    expect(textoCupo('FUTBOL_5', null)).toBe('10/10')
  })

  test('incompleta muestra los cargados sobre el máximo', () => {
    expect(textoCupo('FUTBOL_5', 6)).toBe('6/10')
    expect(textoCupo('PADEL', 3)).toBe('3/4')
  })
})

describe('esIncompleta', () => {
  test('null (completa) no es incompleta', () => {
    expect(esIncompleta('FUTBOL_5', null)).toBe(false)
  })

  test('por debajo del máximo es incompleta', () => {
    expect(esIncompleta('FUTBOL_5', 8)).toBe(true)
  })
})

describe('sumarJugadores', () => {
  test('suma por debajo del máximo deja un número', () => {
    expect(sumarJugadores('FUTBOL_5', 6, 2)).toBe(8)
  })

  test('al llegar al máximo queda en el máximo', () => {
    expect(sumarJugadores('FUTBOL_5', 8, 2)).toBe(10)
  })

  test('si se pasa del máximo, se acota al máximo', () => {
    expect(sumarJugadores('FUTBOL_5', 8, 5)).toBe(10)
  })
})

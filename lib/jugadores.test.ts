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
    expect(normalizarJugadores(10, null)).toBe(null)
  })

  test('un número menor al máximo queda como incompleta', () => {
    expect(normalizarJugadores(10, 6)).toBe(6)
  })

  test('acota al máximo (guarda el número, no null)', () => {
    expect(normalizarJugadores(10, 10)).toBe(10)
    expect(normalizarJugadores(10, 15)).toBe(10)
  })

  test('nunca guarda menos de 1', () => {
    expect(normalizarJugadores(10, 0)).toBe(1)
    expect(normalizarJugadores(10, -3)).toBe(1)
  })
})

describe('jugadoresFaltantes', () => {
  test('completa (null) no falta nadie', () => {
    expect(jugadoresFaltantes(14, null)).toBe(0)
  })

  test('cuenta los que faltan según la capacidad', () => {
    expect(jugadoresFaltantes(14, 10)).toBe(4)
    expect(jugadoresFaltantes(4, 3)).toBe(1)
  })

  test('nunca es negativo', () => {
    expect(jugadoresFaltantes(10, 12)).toBe(0)
  })
})

describe('textoJugadoresFaltantes', () => {
  test('completa no muestra texto', () => {
    expect(textoJugadoresFaltantes(10, null)).toBe(null)
    expect(textoJugadoresFaltantes(10, 10)).toBe(null)
  })

  test('singular cuando falta uno', () => {
    expect(textoJugadoresFaltantes(4, 3)).toBe('Falta 1 jugador para completar')
  })

  test('plural cuando faltan varios', () => {
    expect(textoJugadoresFaltantes(10, 6)).toBe('Faltan 4 jugadores para completar')
  })
})

describe('textoCupo', () => {
  test('completa (null) muestra el máximo sobre el máximo', () => {
    expect(textoCupo(10, null)).toBe('10/10')
  })

  test('incompleta muestra los cargados sobre el máximo', () => {
    expect(textoCupo(10, 6)).toBe('6/10')
    expect(textoCupo(4, 3)).toBe('3/4')
  })
})

describe('esIncompleta', () => {
  test('null (completa) no es incompleta', () => {
    expect(esIncompleta(10, null)).toBe(false)
  })

  test('por debajo del máximo es incompleta', () => {
    expect(esIncompleta(10, 8)).toBe(true)
  })
})

describe('sumarJugadores', () => {
  test('suma por debajo del máximo deja un número', () => {
    expect(sumarJugadores(10, 6, 2)).toBe(8)
  })

  test('al llegar al máximo queda en el máximo', () => {
    expect(sumarJugadores(10, 8, 2)).toBe(10)
  })

  test('si se pasa del máximo, se acota al máximo', () => {
    expect(sumarJugadores(10, 8, 5)).toBe(10)
  })
})

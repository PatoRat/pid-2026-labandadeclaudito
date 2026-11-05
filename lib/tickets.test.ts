import { describe, expect, test } from 'vitest'
import { penalizacionActiva, penalizacionDe } from './tickets'

const ahora = new Date('2026-11-05T12:00:00Z')
const enPlazo = new Date('2026-11-08T12:00:00Z') // todavía no venció
const vencido = new Date('2026-11-01T12:00:00Z') // ya venció

describe('penalizacionDe', () => {
  test('cada reserva invalidada vale 10 puntos', () => {
    expect(penalizacionDe({ reservasInvalidas: 1 })).toBe(10)
    expect(penalizacionDe({ reservasInvalidas: 3 })).toBe(30)
  })
})

describe('penalizacionActiva', () => {
  test('pendiente y en plazo todavía no resta', () => {
    expect(penalizacionActiva({ estado: 'PENDIENTE', venceEn: enPlazo }, ahora)).toBe(false)
  })

  test('pendiente pero vencido se aplica solo', () => {
    expect(penalizacionActiva({ estado: 'PENDIENTE', venceEn: vencido }, ahora)).toBe(true)
  })

  test('confirmado siempre resta, aunque no haya vencido', () => {
    expect(penalizacionActiva({ estado: 'CONFIRMADO', venceEn: enPlazo }, ahora)).toBe(true)
  })

  test('anulado nunca resta, aunque haya vencido', () => {
    expect(penalizacionActiva({ estado: 'ANULADO', venceEn: vencido }, ahora)).toBe(false)
  })
})

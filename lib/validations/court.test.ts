import { describe, expect, test } from 'vitest'
import { updateCourtSchema } from './court'

const base = {
  nombre: 'Cancha 1',
  precioBase: 25000,
  horaApertura: '08:00',
  horaCierre: '23:00',
  duracionTurnoMin: 60,
  capacidad: 10,
  porcentajeSena: null,
  minAdvanceMinutes: null,
}

describe('updateCourtSchema — combinación deporte/superficie', () => {
  test('acepta fútbol con césped sintético', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'FUTBOL_11',
      tipoSuperficie: 'CESPED_SINTETICO',
    })
    expect(parsed.success).toBe(true)
  })

  test('rechaza fútbol con polvo de ladrillo', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'FUTBOL_11',
      tipoSuperficie: 'POLVO_DE_LADRILLO',
    })
    expect(parsed.success).toBe(false)
  })

  test('acepta tenis con polvo de ladrillo', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'TENIS',
      tipoSuperficie: 'POLVO_DE_LADRILLO',
    })
    expect(parsed.success).toBe(true)
  })

  test('rechaza pádel con césped natural', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'PADEL',
      tipoSuperficie: 'CESPED_NATURAL',
    })
    expect(parsed.success).toBe(false)
  })

  test('acepta básquet con parquet', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'BASQUET',
      tipoSuperficie: 'PARQUET',
    })
    expect(parsed.success).toBe(true)
  })

  test('rechaza tenis con parquet (parquet es solo de básquet)', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'TENIS',
      tipoSuperficie: 'PARQUET',
    })
    expect(parsed.success).toBe(false)
  })

  test('rechaza pádel con parquet (parquet es solo de básquet)', () => {
    const parsed = updateCourtSchema.safeParse({
      ...base,
      deporte: 'PADEL',
      tipoSuperficie: 'PARQUET',
    })
    expect(parsed.success).toBe(false)
  })
})

describe('updateCourtSchema — capacidad', () => {
  const futbol5 = { ...base, deporte: 'FUTBOL_5', tipoSuperficie: 'CESPED_SINTETICO' }

  test('acepta de 2 a 30 jugadores', () => {
    expect(updateCourtSchema.safeParse({ ...futbol5, capacidad: 2 }).success).toBe(true)
    expect(updateCourtSchema.safeParse({ ...futbol5, capacidad: '12' }).success).toBe(true)
    expect(updateCourtSchema.safeParse({ ...futbol5, capacidad: 30 }).success).toBe(true)
  })

  test('rechaza menos de 2, más de 30 o vacío', () => {
    expect(updateCourtSchema.safeParse({ ...futbol5, capacidad: 1 }).success).toBe(false)
    expect(updateCourtSchema.safeParse({ ...futbol5, capacidad: 31 }).success).toBe(false)
    expect(updateCourtSchema.safeParse({ ...futbol5, capacidad: '' }).success).toBe(false)
  })
})

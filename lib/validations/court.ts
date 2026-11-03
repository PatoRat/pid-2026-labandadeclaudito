import { z } from 'zod'
import { superficiesPorDeporte } from '@/lib/labels'
import type { Deporte, TipoSuperficie } from '@/lib/generated/prisma/client'

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/

// Mismo chequeo para alta y edición: la superficie tiene que tener sentido
// para el deporte (ej: fútbol nunca en polvo de ladrillo).
function validarCombinacionDeporteSuperficie(
  deporte: Deporte,
  tipoSuperficie: TipoSuperficie,
  ctx: z.RefinementCtx,
) {
  if (!superficiesPorDeporte[deporte].includes(tipoSuperficie)) {
    ctx.addIssue({
      code: 'custom',
      path: ['tipoSuperficie'],
      message: `Esa superficie no es válida para ese deporte`,
    })
  }
}

export const createCourtSchema = z
  .object({
    nombrePrefijo: z.string().min(1, 'Ingresá un nombre o prefijo').max(60),
    cantidad: z.coerce.number().int().min(1).max(20),
    deporte: z.enum(['FUTBOL_5', 'FUTBOL_7', 'FUTBOL_11', 'TENIS', 'PADEL', 'BASQUET']),
    tipoSuperficie: z.enum([
      'CESPED_SINTETICO',
      'CESPED_NATURAL',
      'CEMENTO',
      'PARQUET',
      'POLVO_DE_LADRILLO',
    ]),
    precioBase: z.coerce.number().positive('El precio debe ser mayor a 0'),
    horaApertura: z.string().regex(horaRegex, 'Formato HH:MM'),
    horaCierre: z.string().regex(horaRegex, 'Formato HH:MM'),
    duracionTurnoMin: z.coerce.number().int().min(30).max(180),
    // Máximo de jugadores por reserva (ambos equipos). Al sumarse a un partido
    // incompleto, no se puede pasar de esto.
    capacidad: z.coerce
      .number()
      .int('Tiene que ser un número entero')
      .min(2, 'Mínimo 2 jugadores')
      .max(30, 'Máximo 30 jugadores'),
  })
  .superRefine((data, ctx) =>
    validarCombinacionDeporteSuperficie(data.deporte, data.tipoSuperficie, ctx),
  )

export type CreateCourtInput = z.infer<typeof createCourtSchema>

export const updateCourtSchema = z
  .object({
    nombre: z.string().min(1, 'Ingresá un nombre').max(60),
    deporte: z.enum(['FUTBOL_5', 'FUTBOL_7', 'FUTBOL_11', 'TENIS', 'PADEL', 'BASQUET']),
    tipoSuperficie: z.enum([
      'CESPED_SINTETICO',
      'CESPED_NATURAL',
      'CEMENTO',
      'PARQUET',
      'POLVO_DE_LADRILLO',
    ]),
    precioBase: z.coerce.number().positive('El precio debe ser mayor a 0'),
    horaApertura: z.string().regex(horaRegex, 'Formato HH:MM'),
    horaCierre: z.string().regex(horaRegex, 'Formato HH:MM'),
    duracionTurnoMin: z.coerce.number().int().min(30).max(180),
    // Máximo de jugadores por reserva (ambos equipos). Al sumarse a un partido
    // incompleto, no se puede pasar de esto.
    capacidad: z.coerce
      .number()
      .int('Tiene que ser un número entero')
      .min(2, 'Mínimo 2 jugadores')
      .max(30, 'Máximo 30 jugadores'),
    // null = usa el % de seña por defecto del complejo, no uno propio
    porcentajeSena: z
      .number()
      .int('Tiene que ser un número entero')
      .min(0, 'No puede ser negativo')
      .max(100, 'No puede ser mayor a 100')
      .nullable(),
    // null = usa la anticipación mínima por defecto del complejo
    minAdvanceMinutes: z
      .number()
      .int('Tiene que ser un número entero')
      .min(0, 'No puede ser negativo')
      .max(1439, 'No puede ser más de 23:59 horas')
      .nullable(),
  })
  .superRefine((data, ctx) =>
    validarCombinacionDeporteSuperficie(data.deporte, data.tipoSuperficie, ctx),
  )

export type UpdateCourtInput = z.infer<typeof updateCourtSchema>

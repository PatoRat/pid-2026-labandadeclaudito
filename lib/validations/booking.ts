import { z } from 'zod'
import { esDiaReal } from '@/lib/time'

export const createBookingSchema = z.object({
  canchaId: z.string().min(1),
  fecha: z.string().refine(esDiaReal, 'Fecha inválida'),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  // Ausente = reserva completa. Un número = incompleta (el server lo normaliza
  // al máximo del deporte). Nunca negativo.
  jugadores: z.number().int().min(1).optional(),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>

export const markAttendanceSchema = z.object({
  asistio: z.boolean(),
})

// Edición de los jugadores de una reserva ya creada. null = marcar completa.
export const editPlayersSchema = z.object({
  jugadores: z.number().int().min(1).nullable(),
})

// Sumarse a una reserva incompleta: cuántos jugadores aporta el que se une.
export const joinBookingSchema = z.object({
  jugadores: z.number().int().min(1),
})

// Etiquetar a un amigo en una reserva finalizada: solo su id (el id del que
// etiqueta sale de la sesión, nunca del body).
export const tagPlayerSchema = z.object({
  jugadorId: z.string().min(1),
})

import { z } from 'zod'

// El admin crea el ticket: a qué jugador, cuántas reservas invalida y por qué.
// La penalización en puntos la calcula el server (reservasInvalidas * 10).
export const createTicketSchema = z.object({
  jugadorId: z.string().min(1),
  reservasInvalidas: z
    .number()
    .int('Tiene que ser un número entero')
    .min(1, 'Invalidá al menos una reserva')
    .max(100, 'Son demasiadas reservas'),
  motivo: z
    .string()
    .trim()
    .min(20, 'Explicá el motivo, con al menos 20 caracteres.')
    .max(1000, 'Máximo 1000 caracteres.'),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>

// El admin resuelve: VALIDAR acepta la evidencia (anula la penalización),
// RECHAZAR la rechaza (la deja firme). El comentario lo lee el jugador.
export const resolveTicketSchema = z.object({
  decision: z.enum(['VALIDAR', 'RECHAZAR']),
  comentarioAdmin: z
    .string()
    .trim()
    .min(20, 'Explicá la decisión, con al menos 20 caracteres.')
    .max(1000, 'Máximo 1000 caracteres.'),
})

export type ResolveTicketInput = z.infer<typeof resolveTicketSchema>

export const MAX_EVIDENCIAS_POR_TICKET = 5
export const MAX_EVIDENCIA_BYTES = 4 * 1024 * 1024

// El comentario del jugador es opcional; la imagen no. Igual que las disputas:
// una imagen por request (Vercel corta los bodies de más de 4.5 MB).
export const ticketEvidenceSchema = z.object({
  comentario: z.string().trim().max(1000, 'Máximo 1000 caracteres.').optional(),
  archivo: z
    .instanceof(File, { message: 'Elegí una imagen.' })
    .refine((archivo) => archivo.size <= MAX_EVIDENCIA_BYTES, {
      message: 'La imagen pesa más de 4 MB.',
    })
    .refine((archivo) => ['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type), {
      message: 'Solo se aceptan imágenes JPG, PNG o WebP.',
    }),
})

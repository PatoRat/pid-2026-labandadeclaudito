import { z } from 'zod'

export const MAX_CARACTERES_COMENTARIO = 500

export const rateComplexSchema = z.object({
  puntaje: z
    .number({ message: 'Elegí de 1 a 5 estrellas.' })
    .int('Elegí de 1 a 5 estrellas.')
    .min(1, 'Elegí de 1 a 5 estrellas.')
    .max(5, 'Elegí de 1 a 5 estrellas.'),
  comentario: z
    .string()
    .trim()
    .max(MAX_CARACTERES_COMENTARIO, `Máximo ${MAX_CARACTERES_COMENTARIO} caracteres.`)
    .optional(),
})

export type RateComplexInput = z.infer<typeof rateComplexSchema>

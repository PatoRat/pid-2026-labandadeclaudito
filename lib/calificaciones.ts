import { db } from '@/lib/db'

export type ResumenCalificacion = { promedio: number; cantidad: number }

// Promedio de estrellas y cantidad de opiniones de varios complejos a la vez.
// Lo usa la búsqueda para mostrarlo en cada tarjeta y filtrar por calificación
// mínima. Un solo groupBy en vez de una consulta por complejo (el índice
// @@index([complejoId]) de Calificacion lo soporta).
// Los complejos sin ninguna calificación no vuelven en el groupBy: quedan fuera
// del Map, y el que llama los trata como "sin calificaciones".
export async function getCalificaciones(
  complejoIds: string[],
): Promise<Map<string, ResumenCalificacion>> {
  const filas = await db.calificacion.groupBy({
    by: ['complejoId'],
    where: { complejoId: { in: complejoIds } },
    _avg: { puntaje: true },
    _count: { _all: true },
  })

  const resumenPorComplejo = new Map<string, ResumenCalificacion>()
  for (const fila of filas) {
    resumenPorComplejo.set(fila.complejoId, {
      promedio: fila._avg.puntaje ?? 0,
      cantidad: fila._count._all,
    })
  }
  return resumenPorComplejo
}

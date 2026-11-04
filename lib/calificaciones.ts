export type ResumenCalificacion = { promedio: number; cantidad: number }

// SIMULADO: el modelo Calificacion todavía no existe (lo está haciendo otro
// integrante). Mientras tanto generamos un promedio y una cantidad ESTABLES por
// complejo, así se puede ver cómo queda la UI y probar el filtro de calificación
// mínima con datos que no cambian entre recargas.
//
// Cuando exista el modelo Calificacion, reemplazar SOLO el cuerpo de esta
// función por la query real (la firma ids -> Map no cambia, así nada más del
// feature se toca):
//
//   const filas = await db.calificacion.groupBy({
//     by: ['complejoId'],
//     where: { complejoId: { in: complejoIds } },
//     _avg: { puntaje: true },
//     _count: { _all: true },
//   })
//   const resumenPorComplejo = new Map<string, ResumenCalificacion>()
//   for (const fila of filas) {
//     resumenPorComplejo.set(fila.complejoId, {
//       promedio: fila._avg.puntaje ?? 0,
//       cantidad: fila._count._all,
//     })
//   }
//   return resumenPorComplejo
//
// Es async y recibe la lista de ids a propósito: así el reemplazo es un solo
// lugar y una sola consulta, sin una query por complejo.
export async function getCalificaciones(
  complejoIds: string[],
): Promise<Map<string, ResumenCalificacion>> {
  const resumenPorComplejo = new Map<string, ResumenCalificacion>()

  for (const id of complejoIds) {
    const n = hashEstable(id)
    // 1 de cada 5 complejos queda "sin calificaciones" (cantidad 0)
    if (n % 5 === 0) {
      resumenPorComplejo.set(id, { promedio: 0, cantidad: 0 })
    } else {
      const promedio = 3 + (n % 21) / 10 // 3.0 a 5.0
      const cantidad = 5 + (n % 40)
      resumenPorComplejo.set(id, { promedio, cantidad })
    }
  }

  return resumenPorComplejo
}

// Hash simple y determinístico de un string. Solo se usa para el simulado: con
// el mismo id siempre da el mismo número.
function hashEstable(texto: string): number {
  let hash = 0
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) % 100000
  }
  return hash
}

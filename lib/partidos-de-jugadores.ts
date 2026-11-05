import { db } from '@/lib/db'
import type { PartidoDelJugador } from '@/lib/gamificacion'
import { diaDeReserva } from '@/lib/time'

// Aparte de lib/gamificacion.ts para que esa se pueda usar en componentes de
// cliente (el panel de reserva calcula el descuento) sin traer la base.
// Los partidos de varios jugadores (propios y a los que se sumaron) en una sola
// consulta. Sirve para uno solo (inicio, perfil) y para varios a la vez (el
// nivel de cada organizador en los partidos abiertos, el ranking).
export async function getPartidosDeJugadores(
  jugadorIds: string[],
): Promise<Map<string, PartidoDelJugador[]>> {
  if (jugadorIds.length === 0) return new Map()

  const reservas = await db.reserva.findMany({
    where: {
      OR: [
        { jugadorId: { in: jugadorIds } },
        { participantes: { some: { jugadorId: { in: jugadorIds } } } },
        { etiquetas: { some: { jugadorId: { in: jugadorIds } } } },
      ],
    },
    select: {
      estado: true,
      asistio: true,
      fecha: true,
      horaInicio: true,
      horaFin: true,
      jugadorId: true,
      jugadores: true,
      cancha: { select: { complejoId: true } },
      participantes: { select: { jugadorId: true } },
      calificaciones: { select: { jugadorId: true } },
      etiquetas: { select: { jugadorId: true } },
    },
  })

  const porJugador = new Map<string, PartidoDelJugador[]>(jugadorIds.map((id) => [id, []]))
  for (const reserva of reservas) {
    const partido = {
      estado: reserva.estado,
      asistio: reserva.asistio,
      dia: diaDeReserva(reserva.fecha),
      horaInicio: reserva.horaInicio,
      horaFin: reserva.horaFin,
      jugadores: reserva.jugadores,
      complejoId: reserva.cancha.complejoId,
      etiquetado: false,
    }
    // Una misma reserva cuenta para el que la hizo, para cada uno que se sumó y
    // para cada amigo etiquetado. Los que no se pidieron no están en el Map y
    // se saltean.
    const califico = (jugadorId: string) =>
      reserva.calificaciones.some((calificacion) => calificacion.jugadorId === jugadorId)
    porJugador
      .get(reserva.jugadorId)
      ?.push({ ...partido, propio: true, calificado: califico(reserva.jugadorId) })
    for (const participante of reserva.participantes) {
      porJugador
        .get(participante.jugadorId)
        ?.push({ ...partido, propio: false, calificado: califico(participante.jugadorId) })
    }
    for (const etiqueta of reserva.etiquetas) {
      porJugador
        .get(etiqueta.jugadorId)
        ?.push({ ...partido, propio: false, calificado: false, etiquetado: true })
    }
  }
  return porJugador
}

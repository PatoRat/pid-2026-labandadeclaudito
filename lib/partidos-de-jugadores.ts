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
    }
    // Una misma reserva cuenta para el que la hizo y para cada uno que se sumó.
    // Los que no se pidieron no están en el Map y se saltean.
    porJugador.get(reserva.jugadorId)?.push({ ...partido, propio: true })
    for (const participante of reserva.participantes) {
      porJugador.get(participante.jugadorId)?.push({ ...partido, propio: false })
    }
  }
  return porJugador
}

import { db } from '@/lib/db'
import { complejoVisible } from '@/lib/complejos'
import { pendientesVencidas } from '@/lib/bookings'
import { esIncompleta } from '@/lib/jugadores'
import { nivelDe, puntosDeLosPartidos } from '@/lib/gamificacion'
import { getPartidosDeJugadores } from '@/lib/partidos-de-jugadores'
import { diaDeHoy, diaDeReserva, turnoYaPaso } from '@/lib/time'
import type { Prisma } from '@/lib/generated/prisma/client'
import type { SearchCourtsFilters } from '@/lib/validations/court-search'

// Reservas incompletas de OTROS jugadores a las que el que mira se puede sumar.
// Se usan en el Inicio (feed) y en Buscar canchas. Los filtros (los mismos de la
// búsqueda) son opcionales; en undefined no filtran.
export async function getPartidosAbiertos(jugadorId: string, filtros?: SearchCourtsFilters) {
  const hoy = diaDeHoy()

  const horaInicio: Prisma.StringFilter = {}
  if (filtros?.horaDesde !== undefined) horaInicio.gte = filtros.horaDesde
  if (filtros?.horaHasta !== undefined) horaInicio.lt = filtros.horaHasta

  const precioTurno: Prisma.DecimalFilter = {}
  if (filtros?.precioMin !== undefined) precioTurno.gte = filtros.precioMin
  if (filtros?.precioMax !== undefined) precioTurno.lte = filtros.precioMax

  const reservas = await db.reserva.findMany({
    where: {
      estado: { not: 'CANCELADA' },
      NOT: pendientesVencidas(),
      // Incompleta: tiene un número cargado (las "completa" quedan en null)
      jugadores: { not: null },
      // De otros, y a las que todavía no me sumé
      jugadorId: { not: jugadorId },
      participantes: { none: { jugadorId } },
      // Si hay filtro de fecha, ese día; si no, de hoy en adelante
      fecha: filtros?.fecha !== undefined ? new Date(filtros.fecha) : { gte: new Date(hoy) },
      ...(Object.keys(horaInicio).length > 0 ? { horaInicio } : {}),
      ...(Object.keys(precioTurno).length > 0 ? { precioTurno } : {}),
      cancha: {
        activo: true,
        deporte: filtros?.deporte,
        tipoSuperficie: filtros?.tipoSuperficie,
        complejo: {
          ...complejoVisible(),
          zona:
            filtros?.zona === undefined ? undefined : { equals: filtros.zona, mode: 'insensitive' },
        },
      },
    },
    include: {
      cancha: { include: { complejo: true } },
      jugador: { select: { nombre: true } },
    },
    orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
  })

  // El "< máximo" depende del deporte, así que se termina de filtrar acá. También
  // se descartan los turnos que ya empezaron.
  const abiertos = reservas.filter(
    (reserva) =>
      esIncompleta(reserva.cancha.deporte, reserva.jugadores) &&
      !turnoYaPaso(diaDeReserva(reserva.fecha), reserva.horaInicio),
  )

  // El nivel de cada organizador, para mostrarlo en la tarjeta. Una sola
  // consulta para todos (no una por partido).
  const partidosPorOrganizador = await getPartidosDeJugadores([
    ...new Set(abiertos.map((reserva) => reserva.jugadorId)),
  ])
  return abiertos.map((reserva) => ({
    ...reserva,
    nivelDelOrganizador: nivelDe(
      puntosDeLosPartidos(partidosPorOrganizador.get(reserva.jugadorId) ?? []),
    ).actual.nombre,
  }))
}

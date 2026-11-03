import { db } from '@/lib/db'
import { getBlocksOfDay, isSlotBlocked } from '@/lib/blocks'
import { pendientesVencidas } from '@/lib/bookings'
import { complejoVisible } from '@/lib/complejos'
import { esIncompleta } from '@/lib/jugadores'
import { Prisma } from '@/lib/generated/prisma/client'
import {
  diaDeReserva,
  diaSemanaDeReserva,
  generateSlots,
  horariosSeSuperponen,
  isTooSoonToBook,
} from '@/lib/time'

type PrecioEspecialVigente = {
  diaSemana: number | null
  horaInicio: string | null
  horaFin: string | null
  precio: Prisma.Decimal
}

// Elige, entre los PrecioEspecial que matchean el día/hora de un turno, el
// más específico: franja horaria gana sobre solo día, que gana sobre general
// (ni día ni franja). Sin ninguno que matchee, se usa precioBase.
export function precioDelTurno(
  precioBase: Prisma.Decimal,
  preciosEspeciales: PrecioEspecialVigente[],
  diaSemana: number,
  horaInicio: string,
): Prisma.Decimal {
  const queMatchean = preciosEspeciales.filter((precioEspecial) => {
    const diaOk = precioEspecial.diaSemana === null || precioEspecial.diaSemana === diaSemana
    const franjaOk =
      precioEspecial.horaInicio === null ||
      (horaInicio >= precioEspecial.horaInicio && horaInicio < precioEspecial.horaFin!)
    return diaOk && franjaOk
  })

  if (queMatchean.length === 0) {
    return precioBase
  }

  const masEspecifico = queMatchean.reduce((mejor, actual) => {
    const puntos = (p: PrecioEspecialVigente) =>
      (p.horaInicio !== null ? 2 : 0) + (p.diaSemana !== null ? 1 : 0)
    return puntos(actual) > puntos(mejor) ? actual : mejor
  })

  return masEspecifico.precio
}

type FranjaDePrecio = {
  diaSemana: number | null
  horaInicio: string | null
  horaFin: string | null
}

// Dos precios especiales de una cancha chocan si tienen la misma prioridad
// (mismo día, y los dos con franja o los dos sin) y cubren algún turno en
// común: precioDelTurno no tendría cómo elegir entre los dos.
export function preciosChocan(a: FranjaDePrecio, b: FranjaDePrecio): boolean {
  if (a.diaSemana !== b.diaSemana) return false
  if (a.horaInicio === null || b.horaInicio === null) {
    return a.horaInicio === null && b.horaInicio === null
  }
  return horariosSeSuperponen(a.horaInicio, a.horaFin!, b.horaInicio, b.horaFin!)
}

// El último turno del día puede ser más corto que duracionTurnoMin (ver
// agregarSlots en lib/time.ts). Ese turno cobra la parte proporcional:
// 30 min de un turno de 90 = 1/3 del precio.
export function precioProporcional(
  precio: Prisma.Decimal,
  horaInicio: string,
  horaFin: string,
  duracionTurnoMin: number,
): Prisma.Decimal {
  const [inicioH, inicioM] = horaInicio.split(':').map(Number)
  const [finH, finM] = horaFin.split(':').map(Number)

  let minutosDelTurno = finH * 60 + finM - (inicioH * 60 + inicioM)
  // Un turno que termina a las 00:00 da negativo: termina al día siguiente
  if (minutosDelTurno <= 0) {
    minutosDelTurno += 24 * 60
  }

  if (minutosDelTurno >= duracionTurnoMin) {
    return precio
  }

  return precio.mul(minutosDelTurno).div(duracionTurnoMin).toDecimalPlaces(2)
}

export async function getAvailableSlots(
  canchaId: string,
  fecha: Date,
  jugadorId?: string,
): Promise<{
  slots: {
    horaInicio: string
    horaFin: string
    disponible: boolean
    bloqueado: boolean
    // reservada: ocupada por una reserva (no por un bloqueo ni por otro motivo).
    // jugadores: cuántos cargó esa reserva (null = completa). Sirve para mostrar
    // el cupo y el precio del turno que ya tomó otro jugador.
    reservada: boolean
    jugadores: number | null
    // reservaId: id de la reserva que ocupa el turno (para poder sumarse).
    // puedeUnirse: el que mira puede sumarse a esa reserva incompleta.
    reservaId: string | null
    puedeUnirse: boolean
    precio: Prisma.Decimal
  }[]
  porcentajeSena: number
  minAdvanceMinutes: number
} | null> {
  // Las cuatro consultas no dependen entre sí, así que se hacen a la vez: una
  // sola espera a la base en lugar de cuatro seguidas. Esta grilla se pide al
  // abrir el sheet y cada pocos segundos mientras está abierto.
  const [cancha, reservas, bloqueosDelDia, reservasDelJugador] = await Promise.all([
    db.cancha.findFirst({
      where: { id: canchaId, activo: true, complejo: complejoVisible() },
      include: {
        complejo: { select: { porcentajeSenaDefault: true, minAdvanceMinutesDefault: true } },
        preciosEspeciales: { where: { activo: true } },
      },
    }),
    db.reserva.findMany({
      where: {
        canchaId,
        fecha,
        estado: { not: 'CANCELADA' },
        NOT: pendientesVencidas(),
      },
      select: {
        id: true,
        horaInicio: true,
        jugadores: true,
        jugadorId: true,
        participantes: { select: { jugadorId: true } },
      },
    }),
    getBlocksOfDay(canchaId, fecha),
    // Si mira un jugador, también se marcan ocupados los turnos que se cruzan
    // con otra reserva suya o a la que se sumó (en cualquier cancha): no puede
    // estar en dos lados a la vez. POST /api/bookings hace el mismo chequeo.
    jugadorId
      ? db.reserva.findMany({
          where: {
            OR: [{ jugadorId }, { participantes: { some: { jugadorId } } }],
            fecha,
            estado: { not: 'CANCELADA' },
            NOT: pendientesVencidas(),
          },
          select: { horaInicio: true, horaFin: true },
        })
      : [],
  ])
  if (!cancha) {
    return null
  }

  const turnos = generateSlots(cancha.horaApertura, cancha.horaCierre, cancha.duracionTurnoMin)
  const horasOcupadas = new Set(reservas.map((r) => r.horaInicio))
  // La reserva que ocupa cada hora, para mostrar el cupo y decidir si el que
  // mira puede sumarse
  const reservaPorHora = new Map(reservas.map((r) => [r.horaInicio, r]))

  const dia = diaDeReserva(fecha)
  const minAdvanceMinutes = cancha.minAdvanceMinutes ?? cancha.complejo.minAdvanceMinutesDefault
  const diaSemana = diaSemanaDeReserva(fecha)

  const slots = turnos.map(({ horaInicio, horaFin }) => {
    const seCruzaConReservaDelJugador = reservasDelJugador.some((reserva) =>
      horariosSeSuperponen(horaInicio, horaFin, reserva.horaInicio, reserva.horaFin),
    )

    // bloqueado aparte de disponible: la búsqueda lo usa para mostrar en gris
    // una cancha que ese día no tiene turnos porque el dueño la bloqueó
    const bloqueado = isSlotBlocked(horaInicio, horaFin, bloqueosDelDia)
    const reservada = horasOcupadas.has(horaInicio)
    const reservaDelTurno = reservaPorHora.get(horaInicio)
    const aTiempo = !isTooSoonToBook(dia, horaInicio, minAdvanceMinutes)

    // El que mira puede sumarse si el turno lo tiene otra reserva incompleta,
    // él no es el dueño de esa reserva ni ya se sumó, y no tiene un turno que se
    // cruce. El dueño del complejo (sin jugadorId) nunca se suma.
    const puedeUnirse =
      reservaDelTurno !== undefined &&
      jugadorId !== undefined &&
      esIncompleta(cancha.capacidad, reservaDelTurno.jugadores) &&
      reservaDelTurno.jugadorId !== jugadorId &&
      !reservaDelTurno.participantes.some((p) => p.jugadorId === jugadorId) &&
      !seCruzaConReservaDelJugador &&
      aTiempo &&
      !bloqueado

    return {
      horaInicio,
      horaFin,
      disponible: !reservada && aTiempo && !bloqueado && !seCruzaConReservaDelJugador,
      bloqueado,
      reservada,
      jugadores: reservaDelTurno?.jugadores ?? null,
      reservaId: reservaDelTurno?.id ?? null,
      puedeUnirse,
      precio: precioProporcional(
        precioDelTurno(cancha.precioBase, cancha.preciosEspeciales, diaSemana, horaInicio),
        horaInicio,
        horaFin,
        cancha.duracionTurnoMin,
      ),
    }
  })

  return {
    slots,
    porcentajeSena: cancha.porcentajeSena ?? cancha.complejo.porcentajeSenaDefault,
    minAdvanceMinutes,
  }
}

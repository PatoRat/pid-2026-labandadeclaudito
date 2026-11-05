import { NextResponse } from 'next/server'
import { Prisma } from '@/lib/generated/prisma/client'
import { createBookingSchema } from '@/lib/validations/booking'
import { requireRole } from '@/lib/auth-helpers'
import { precioDelTurno, precioProporcional } from '@/lib/availability'
import { getBlocksOfDay, isSlotBlocked } from '@/lib/blocks'
import { pendientesVencidas } from '@/lib/bookings'
import { complejoVisible } from '@/lib/complejos'
import { normalizarJugadores } from '@/lib/jugadores'
import { montoDelDescuento, nivelDe } from '@/lib/gamificacion'
import { puntosDeUnJugador } from '@/lib/puntos-del-jugador'
import {
  DIAS_MAXIMOS_DE_ANTICIPACION,
  diaSemanaDeReserva,
  formatAdvanceTime,
  generateSlots,
  horariosSeSuperponen,
  isTooSoonToBook,
  ultimoDiaParaReservar,
} from '@/lib/time'
import { db } from '@/lib/db'

// Cuántas reservas sin seña pagada puede tener un jugador a la vez
const MAXIMO_RESERVAS_PENDIENTES = 3

export async function POST(request: Request) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const body = await request.json()
  const parsed = createBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  // Baja física de las reservas pendientes que no pagaron la seña a tiempo.
  // No hay cron: se aprovecha cada pedido de reserva para barrerlas. Mientras
  // tanto, el resto de las consultas las ignora con NOT: pendientesVencidas().
  await db.reserva.deleteMany({ where: pendientesVencidas() })

  // Límite 1: no se reserva para dentro de más de 30 días.
  if (parsed.data.fecha > ultimoDiaParaReservar()) {
    return NextResponse.json(
      { error: `Se puede reservar con hasta ${DIAS_MAXIMOS_DE_ANTICIPACION} días de anticipación` },
      { status: 400 },
    )
  }

  // Límite 2: una reserva sin seña bloquea el turno sin poner plata. Para que
  // nadie tome muchos turnos así, hay un tope de pendientes a la vez; las
  // confirmadas no cuentan (esas ya pagaron la seña).
  // ponytail: dos pedidos simultáneos podrían pasarse del tope por uno; si
  // importa, contar y crear adentro de una transacción.
  const pendientesDelJugador = await db.reserva.count({
    where: { jugadorId: session.user.id, estado: 'PENDIENTE' },
  })
  if (pendientesDelJugador >= MAXIMO_RESERVAS_PENDIENTES) {
    return NextResponse.json(
      {
        error: `Tenés ${MAXIMO_RESERVAS_PENDIENTES} reservas sin pagar la seña. Pagá o cancelá alguna antes de reservar otra.`,
      },
      { status: 409 },
    )
  }

  const cancha = await db.cancha.findFirst({
    where: {
      id: parsed.data.canchaId,
      activo: true,
      complejo: complejoVisible(),
    },
    include: {
      preciosEspeciales: { where: { activo: true } },
      complejo: { select: { minAdvanceMinutesDefault: true, porcentajeSenaDefault: true } },
    },
  })
  if (!cancha) {
    return NextResponse.json({ error: 'La cancha no existe' }, { status: 404 })
  }

  const minAdvanceMinutes = cancha.minAdvanceMinutes ?? cancha.complejo.minAdvanceMinutesDefault
  if (isTooSoonToBook(parsed.data.fecha, parsed.data.horaInicio, minAdvanceMinutes)) {
    if (minAdvanceMinutes === 0) {
      return NextResponse.json({ error: 'Ese turno ya pasó' }, { status: 400 })
    }
    return NextResponse.json(
      {
        error: `Este turno se reserva con al menos ${formatAdvanceTime(minAdvanceMinutes)} de anticipación`,
      },
      { status: 400 },
    )
  }

  // La grilla de turnos también se muestra en el cliente, pero acá hay que
  // recalcularla: un POST directo podría pedir un horario fuera del horario
  // de la cancha o pisado entre dos turnos.
  const slots = generateSlots(cancha.horaApertura, cancha.horaCierre, cancha.duracionTurnoMin)
  const turnoPedido = slots.find((slot) => slot.horaInicio === parsed.data.horaInicio)
  if (!turnoPedido) {
    return NextResponse.json(
      { error: 'Ese horario no es un turno de esta cancha' },
      { status: 400 },
    )
  }

  const fecha = new Date(parsed.data.fecha)
  const horaFin = turnoPedido.horaFin

  const bloqueosDelDia = await getBlocksOfDay(cancha.id, fecha)
  if (isSlotBlocked(parsed.data.horaInicio, horaFin, bloqueosDelDia)) {
    return NextResponse.json({ error: 'Ese horario está bloqueado' }, { status: 409 })
  }

  // Un jugador no puede estar en dos canchas a la vez: se busca otra reserva
  // ese mismo día (suya o a la que se sumó) cuyo horario se cruce con el turno
  // pedido.
  const reservasDelJugador = await db.reserva.findMany({
    where: {
      OR: [
        { jugadorId: session.user.id },
        { participantes: { some: { jugadorId: session.user.id } } },
      ],
      fecha,
      estado: { not: 'CANCELADA' },
    },
  })
  for (const otraReserva of reservasDelJugador) {
    if (
      horariosSeSuperponen(
        parsed.data.horaInicio,
        horaFin,
        otraReserva.horaInicio,
        otraReserva.horaFin,
      )
    ) {
      return NextResponse.json(
        { error: 'Ya tenés otra reserva que se superpone con ese horario' },
        { status: 409 },
      )
    }
  }

  // El precio se calcula siempre acá, nunca se confía en lo que mande el
  // cliente: precioBase puede tener un PrecioEspecial pisándolo. Queda
  // congelado en la Reserva para siempre.
  const precioCompleto = precioDelTurno(
    cancha.precioBase,
    cancha.preciosEspeciales,
    diaSemanaDeReserva(fecha),
    parsed.data.horaInicio,
  )
  const precioTurno = precioProporcional(
    precioCompleto,
    parsed.data.horaInicio,
    horaFin,
    cancha.duracionTurnoMin,
  )

  // Descuento por el nivel que tiene el jugador hoy: queda congelado en la
  // reserva aunque después suba o baje de nivel. Mismo % de seña que usa
  // /deposit, para que el descuento nunca pase lo que se paga en la cancha.
  const { actual: nivel } = nivelDe(await puntosDeUnJugador(session.user.id))
  const descuento = montoDelDescuento(
    Number(precioTurno),
    nivel.descuento,
    cancha.porcentajeSena ?? cancha.complejo.porcentajeSenaDefault,
  )

  // Las canceladas no ocupan el turno: reservar uno cancelado crea una fila
  // nueva y la cancelada queda en el historial de su jugador, con su pago.
  const reservaActiva = await db.reserva.findFirst({
    where: {
      canchaId: cancha.id,
      fecha,
      horaInicio: parsed.data.horaInicio,
      estado: { not: 'CANCELADA' },
    },
  })
  if (reservaActiva) {
    return NextResponse.json({ error: 'Ese horario ya fue reservado' }, { status: 409 })
  }

  // Sin jugadores en el body la reserva es completa (null). Con un número,
  // está incompleta: se normaliza al máximo del deporte (nunca más que el
  // máximo, nunca negativo).
  const jugadores =
    parsed.data.jugadores === undefined
      ? null
      : normalizarJugadores(cancha.capacidad, parsed.data.jugadores)

  // La reserva nace PENDIENTE (de seña): pasa a CONFIRMADA recién cuando el
  // jugador paga la seña en POST /api/bookings/[id]/deposit.
  try {
    const reserva = await db.reserva.create({
      data: {
        canchaId: cancha.id,
        jugadorId: session.user.id,
        fecha,
        horaInicio: parsed.data.horaInicio,
        horaFin,
        estado: 'PENDIENTE',
        precioTurno,
        descuento,
        jugadores,
      },
    })
    return NextResponse.json({ reserva }, { status: 201 })
  } catch (e) {
    // Dos jugadores pidiendo el mismo turno a la vez: el índice único lo corta.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ese horario ya fue reservado' }, { status: 409 })
    }
    throw e
  }
}

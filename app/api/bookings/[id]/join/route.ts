import { NextResponse } from 'next/server'
import { Prisma } from '@/lib/generated/prisma/client'
import { joinBookingSchema } from '@/lib/validations/booking'
import { requireRole } from '@/lib/auth-helpers'
import { esIncompleta, sumarJugadores } from '@/lib/jugadores'
import { senaVencida } from '@/lib/estado-reserva'
import { diaDeReserva, horariosSeSuperponen, turnoYaPaso } from '@/lib/time'
import { db } from '@/lib/db'

// Sumarse a una reserva incompleta de otro jugador. No se paga nada: solo se
// aumenta la cantidad de jugadores y se guarda que este jugador ya está adentro.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id } = await params

  const body = await request.json()
  const parsed = joinBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const reserva = await db.reserva.findUnique({
    where: { id },
    include: { cancha: true, participantes: { select: { jugadorId: true } } },
  })
  if (!reserva) {
    return NextResponse.json({ error: 'La reserva no existe' }, { status: 404 })
  }
  if (reserva.estado === 'CANCELADA') {
    return NextResponse.json({ error: 'La reserva está cancelada' }, { status: 409 })
  }
  if (reserva.estado === 'PENDIENTE' && senaVencida(reserva.createdAt)) {
    return NextResponse.json({ error: 'La reserva ya no está disponible' }, { status: 409 })
  }
  if (turnoYaPaso(diaDeReserva(reserva.fecha), reserva.horaInicio)) {
    return NextResponse.json({ error: 'El turno ya empezó' }, { status: 400 })
  }
  if (reserva.jugadorId === session.user.id) {
    return NextResponse.json({ error: 'Esta reserva es tuya' }, { status: 409 })
  }
  if (reserva.participantes.some((p) => p.jugadorId === session.user.id)) {
    return NextResponse.json({ error: 'Ya te sumaste a esta reserva' }, { status: 409 })
  }
  if (!esIncompleta(reserva.cancha.capacidad, reserva.jugadores)) {
    return NextResponse.json({ error: 'La reserva ya está completa' }, { status: 409 })
  }

  // No se puede estar en dos canchas a la vez: se busca otra reserva ese día
  // (propia o a la que ya se sumó) cuyo horario se cruce con este turno (mismo
  // chequeo que al reservar).
  const reservasDelJugador = await db.reserva.findMany({
    where: {
      OR: [
        { jugadorId: session.user.id },
        { participantes: { some: { jugadorId: session.user.id } } },
      ],
      fecha: reserva.fecha,
      estado: { not: 'CANCELADA' },
    },
  })
  for (const otra of reservasDelJugador) {
    if (horariosSeSuperponen(reserva.horaInicio, reserva.horaFin, otra.horaInicio, otra.horaFin)) {
      return NextResponse.json(
        { error: 'Ya tenés otra reserva que se superpone con ese horario' },
        { status: 409 },
      )
    }
  }

  // Lo que realmente aporta puede ser menos que lo pedido si no entra tanto. Se
  // guarda el aporte en el participante para poder restarlo exacto si se sale.
  const nuevoTotal = sumarJugadores(
    reserva.cancha.capacidad,
    reserva.jugadores,
    parsed.data.jugadores,
  )
  const aporte = nuevoTotal - (reserva.jugadores ?? 0)

  // Si otro se sumó entre que se leyó la reserva y ahora, el total ya no es el
  // que se leyó: se actualiza solo si sigue igual, así no se pisa su aporte ni
  // se pasa del máximo.
  let sumado: boolean
  try {
    sumado = await db.$transaction(async (tx) => {
      const actualizadas = await tx.reserva.updateMany({
        where: { id, jugadores: reserva.jugadores },
        data: { jugadores: nuevoTotal },
      })
      if (actualizadas.count === 0) return false

      await tx.participanteReserva.create({
        data: { reservaId: id, jugadorId: session.user.id, jugadores: aporte },
      })
      return true
    })
  } catch (e) {
    // Dos pedidos del mismo jugador a la vez: el índice único lo corta.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya te sumaste a esta reserva' }, { status: 409 })
    }
    throw e
  }
  if (!sumado) {
    return NextResponse.json(
      { error: 'Alguien se sumó mientras tanto. Recargá la página.' },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

// Salirse de una reserva a la que te habías sumado. Resta tu aporte del cupo,
// así el turno vuelve a quedar disponible para que otros se sumen.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id } = await params

  const reserva = await db.reserva.findUnique({
    where: { id },
    include: { participantes: { where: { jugadorId: session.user.id } } },
  })
  if (!reserva) {
    return NextResponse.json({ error: 'La reserva no existe' }, { status: 404 })
  }
  const participante = reserva.participantes[0]
  if (!participante) {
    return NextResponse.json({ error: 'No estás sumado a esta reserva' }, { status: 409 })
  }
  if (reserva.estado === 'CANCELADA') {
    return NextResponse.json({ error: 'La reserva está cancelada' }, { status: 409 })
  }
  if (turnoYaPaso(diaDeReserva(reserva.fecha), reserva.horaInicio)) {
    return NextResponse.json({ error: 'El turno ya empezó' }, { status: 400 })
  }

  const jugadores = (reserva.jugadores ?? participante.jugadores) - participante.jugadores

  await db.$transaction([
    db.participanteReserva.delete({ where: { id: participante.id } }),
    db.reserva.update({ where: { id }, data: { jugadores } }),
  ])

  return NextResponse.json({ ok: true }, { status: 200 })
}

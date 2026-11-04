import { NextResponse } from 'next/server'
import { Prisma } from '@/lib/generated/prisma/client'
import { rateComplexSchema } from '@/lib/validations/rating'
import { requireRole } from '@/lib/auth-helpers'
import { sePuedeCalificar } from '@/lib/estado-reserva'
import { diaDeReserva, momentoActual } from '@/lib/time'
import { db } from '@/lib/db'

// El jugador le pone de 1 a 5 estrellas al complejo donde jugó. Califican el
// que reservó y cada uno que se sumó al partido, una vez cada uno.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id } = await params

  const body = await request.json()
  const parsed = rateComplexSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const reserva = await db.reserva.findUnique({
    where: { id },
    include: { cancha: true, participantes: { where: { jugadorId: session.user.id } } },
  })
  if (!reserva) {
    return NextResponse.json({ error: 'La reserva no existe' }, { status: 404 })
  }

  const esElQueReservo = reserva.jugadorId === session.user.id
  const seSumo = reserva.participantes.length > 0
  if (!esElQueReservo && !seSumo) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const turno = {
    estado: reserva.estado,
    asistio: reserva.asistio,
    dia: diaDeReserva(reserva.fecha),
    horaInicio: reserva.horaInicio,
    horaFin: reserva.horaFin,
  }
  if (!sePuedeCalificar(turno, momentoActual())) {
    return NextResponse.json(
      { error: 'Solo se puede calificar un turno que ya jugaste' },
      { status: 409 },
    )
  }

  // Un comentario con solo espacios llega vacío después del trim de Zod
  const comentario = parsed.data.comentario ? parsed.data.comentario : null

  try {
    await db.calificacion.create({
      data: {
        reservaId: reserva.id,
        jugadorId: session.user.id,
        complejoId: reserva.cancha.complejoId,
        puntaje: parsed.data.puntaje,
        comentario,
      },
    })
  } catch (e) {
    // Ya calificó este turno (o mandó dos pedidos a la vez): el @@unique de
    // reservaId + jugadorId frena al segundo.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya calificaste este turno' }, { status: 409 })
    }
    throw e
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

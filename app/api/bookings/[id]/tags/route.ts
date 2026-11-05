import { NextResponse } from 'next/server'
import { Prisma } from '@/lib/generated/prisma/client'
import { tagPlayerSchema } from '@/lib/validations/booking'
import { requireRole } from '@/lib/auth-helpers'
import { estadoDeReserva } from '@/lib/estado-reserva'
import { diaDeReserva, momentoActual } from '@/lib/time'
import { db } from '@/lib/db'

// Solo el que hizo la reserva puede etiquetar, y solo en una reserva que ya se
// jugó. Devuelve la reserva con lo necesario para validar, o una respuesta de
// error lista para mandar.
async function reservaParaEtiquetar(reservaId: string, jugadorLogueado: string) {
  const reserva = await db.reserva.findUnique({
    where: { id: reservaId },
    include: { participantes: { select: { jugadorId: true } } },
  })
  if (!reserva) {
    return { error: NextResponse.json({ error: 'La reserva no existe' }, { status: 404 }) }
  }
  // Ownership: el id del que etiqueta sale de la sesión, no del body
  if (reserva.jugadorId !== jugadorLogueado) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  }
  return { reserva }
}

// POST: etiquetar a un amigo en una reserva finalizada.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: reservaId } = await params
  const body = await request.json()
  const parsed = tagPlayerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }
  const jugadorId = parsed.data.jugadorId

  const resultado = await reservaParaEtiquetar(reservaId, session.user.id)
  if (resultado.error) return resultado.error
  const reserva = resultado.reserva

  // La reserva tiene que haberse jugado: terminada (FINALIZADA) o con asistencia
  // (ASISTIO). No tiene sentido etiquetar un turno futuro o cancelado.
  const estado = estadoDeReserva(
    {
      estado: reserva.estado,
      asistio: reserva.asistio,
      dia: diaDeReserva(reserva.fecha),
      horaInicio: reserva.horaInicio,
      horaFin: reserva.horaFin,
    },
    momentoActual(),
  )
  if (estado !== 'FINALIZADA' && estado !== 'ASISTIO') {
    return NextResponse.json(
      { error: 'Solo podés etiquetar amigos en un partido que ya se jugó' },
      { status: 409 },
    )
  }

  if (jugadorId === session.user.id) {
    return NextResponse.json({ error: 'No podés etiquetarte a vos mismo' }, { status: 400 })
  }
  // El que se sumó al partido ya suma puntos por su cuenta: no se etiqueta
  if (reserva.participantes.some((participante) => participante.jugadorId === jugadorId)) {
    return NextResponse.json({ error: 'Ese jugador ya está en el partido' }, { status: 409 })
  }

  // Tiene que ser un jugador real y activo (no un dueño ni una cuenta dada de baja)
  const amigo = await db.usuario.findFirst({
    where: { id: jugadorId, rol: 'JUGADOR', activo: true },
    select: { id: true },
  })
  if (!amigo) {
    return NextResponse.json({ error: 'Ese jugador no existe' }, { status: 404 })
  }

  try {
    await db.etiquetaReserva.create({
      data: { reservaId, jugadorId, etiquetadoPor: session.user.id },
    })
  } catch (e) {
    // Ya estaba etiquetado: el índice único lo corta
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya etiquetaste a ese jugador' }, { status: 409 })
    }
    throw e
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}

// DELETE: quitar una etiqueta propia (para corregir).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: reservaId } = await params
  const body = await request.json()
  const parsed = tagPlayerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const resultado = await reservaParaEtiquetar(reservaId, session.user.id)
  if (resultado.error) return resultado.error

  await db.etiquetaReserva.deleteMany({
    where: { reservaId, jugadorId: parsed.data.jugadorId },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}

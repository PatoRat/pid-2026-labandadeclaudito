import { NextResponse } from 'next/server'
import { editPlayersSchema } from '@/lib/validations/booking'
import { requireRole } from '@/lib/auth-helpers'
import { normalizarJugadores } from '@/lib/jugadores'
import { diaDeReserva, turnoYaPaso } from '@/lib/time'
import { db } from '@/lib/db'

// Editar los jugadores de una reserva: marcarla completa (jugadores: null) o
// cargar cuántos hay (un número, que se normaliza al máximo del deporte).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id } = await params

  const body = await request.json()
  const parsed = editPlayersSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const reserva = await db.reserva.findUnique({
    where: { id },
    include: { cancha: true },
  })
  if (!reserva) {
    return NextResponse.json({ error: 'La reserva no existe' }, { status: 404 })
  }
  if (reserva.jugadorId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (reserva.estado === 'CANCELADA') {
    return NextResponse.json({ error: 'La reserva está cancelada' }, { status: 409 })
  }
  if (turnoYaPaso(diaDeReserva(reserva.fecha), reserva.horaInicio)) {
    return NextResponse.json({ error: 'El turno ya empezó' }, { status: 400 })
  }

  const jugadores = normalizarJugadores(reserva.cancha.deporte, parsed.data.jugadores)
  await db.reserva.update({ where: { id }, data: { jugadores } })

  return NextResponse.json({ ok: true }, { status: 200 })
}

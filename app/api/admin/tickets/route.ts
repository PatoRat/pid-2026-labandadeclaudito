import { NextResponse } from 'next/server'
import { createTicketSchema } from '@/lib/validations/ticket'
import { requireRole } from '@/lib/auth-helpers'
import { venceElTicket } from '@/lib/tickets'
import { puntosDeUnJugador } from '@/lib/puntos-del-jugador'
import { db } from '@/lib/db'

// El admin penaliza a un jugador: crea un ticket con cuántas reservas invalida.
// La penalización en puntos se deriva de eso (ver lib/tickets.ts); acá solo se
// guarda el dato y un snapshot de los puntos actuales, para mostrar el "antes".
export async function POST(request: Request) {
  const { session, error, status } = await requireRole('ADMIN')
  if (!session) return NextResponse.json({ error }, { status })

  const body = await request.json()
  const parsed = createTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const jugador = await db.usuario.findFirst({
    where: { id: parsed.data.jugadorId, rol: 'JUGADOR' },
    select: { id: true },
  })
  if (!jugador) {
    return NextResponse.json({ error: 'Ese jugador no existe' }, { status: 404 })
  }

  const puntosAnteriores = await puntosDeUnJugador(jugador.id)

  const ticket = await db.ticket.create({
    data: {
      jugadorId: jugador.id,
      adminId: session.user.id,
      reservasInvalidas: parsed.data.reservasInvalidas,
      puntosAnteriores,
      motivo: parsed.data.motivo,
      venceEn: venceElTicket(new Date()),
    },
  })

  return NextResponse.json({ id: ticket.id }, { status: 201 })
}

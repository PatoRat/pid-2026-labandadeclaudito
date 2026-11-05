import { NextResponse } from 'next/server'
import { resolveTicketSchema } from '@/lib/validations/ticket'
import { requireRole } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

// El admin resuelve el ticket a partir de la evidencia del jugador:
// - VALIDAR: la evidencia convence, la penalización se anula (ANULADO).
// - RECHAZAR: no convence, la penalización queda firme (CONFIRMADO).
// Una vez resuelto no se vuelve a tocar, queda como registro. (Después de los 5
// días la penalización ya se aplica sola, pero resolver deja la decisión firme
// y saca el ticket del inicio del jugador.)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('ADMIN')
  if (!session) return NextResponse.json({ error }, { status })

  const { id } = await params

  const body = await request.json()
  const parsed = resolveTicketSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const ticket = await db.ticket.findUnique({ where: { id }, select: { estado: true } })
  if (!ticket) {
    return NextResponse.json({ error: 'El ticket no existe' }, { status: 404 })
  }
  if (ticket.estado !== 'PENDIENTE') {
    return NextResponse.json({ error: 'El ticket ya está resuelto' }, { status: 409 })
  }

  await db.ticket.update({
    where: { id },
    data: {
      estado: parsed.data.decision === 'VALIDAR' ? 'ANULADO' : 'CONFIRMADO',
      comentarioAdmin: parsed.data.comentarioAdmin,
      resueltoEn: new Date(),
    },
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}

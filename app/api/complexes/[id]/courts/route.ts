import { NextResponse } from 'next/server'
import { createCourtSchema } from '@/lib/validations/court'
import { requireRole } from '@/lib/auth-helpers'
import { getComplexByOwner } from '@/lib/ownership'
import { db } from '@/lib/db'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('DUENIO')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: complejoId } = await params

  const complejo = await getComplexByOwner(complejoId, session.user.id)
  if (!complejo) {
    return NextResponse.json({ error: 'Complejo no encontrado' }, { status: 404 })
  }

  const body = await request.json()
  const parsed = createCourtSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { nombrePrefijo, cantidad, ...datosComunes } = parsed.data

  const canchasCreadas = []
  for (let i = 1; i <= cantidad; i++) {
    const cancha = await db.cancha.create({
      data: {
        ...datosComunes,
        nombre: `${nombrePrefijo} ${i}`,
        complejoId,
      },
    })
    canchasCreadas.push(cancha)
  }

  return NextResponse.json({ canchas: canchasCreadas }, { status: 201 })
}

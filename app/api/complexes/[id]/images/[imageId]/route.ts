import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-helpers'
import { db } from '@/lib/db'
import { borrarArchivo } from '@/lib/archivos'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { session, error, status } = await requireRole('DUENIO')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: complejoId, imageId } = await params

  const imagen = await db.imagenComplejo.findFirst({
    where: {
      id: imageId,
      complejoId,
      activo: true,
      complejo: { duenioId: session.user.id, activo: true },
    },
  })
  if (!imagen) {
    return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 })
  }

  await db.imagenComplejo.delete({ where: { id: imageId } })
  await borrarArchivo(imagen.url)

  return NextResponse.json({ ok: true }, { status: 200 })
}

import { NextResponse } from 'next/server'
import { esImagenReal } from '@/lib/validations/complex'
import { disputeEvidenceSchema, MAX_EVIDENCIAS_POR_DISPUTA } from '@/lib/validations/dispute'
import { requireRole } from '@/lib/auth-helpers'
import { guardarArchivo } from '@/lib/archivos'
import { db } from '@/lib/db'

// Se sube una imagen por request: Vercel corta los bodies de más de 4.5 MB.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: disputaId } = await params

  const disputa = await db.disputa.findUnique({ where: { id: disputaId } })
  if (!disputa) {
    return NextResponse.json({ error: 'La disputa no existe' }, { status: 404 })
  }
  if (disputa.jugadorId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  // Una disputa resuelta es el registro de la decisión: no se le agrega nada
  if (disputa.estado === 'RESUELTA') {
    return NextResponse.json({ error: 'La disputa ya está resuelta' }, { status: 409 })
  }

  const formData = await request.formData()
  const parsed = disputeEvidenceSchema.safeParse({ archivo: formData.get('archivo') })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const archivo = parsed.data.archivo
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  if (!esImagenReal(bytes)) {
    return NextResponse.json(
      { error: 'Solo se aceptan imágenes JPG, PNG o WebP.' },
      { status: 400 },
    )
  }

  const cantidad = await db.evidenciaDisputa.count({ where: { disputaId } })
  if (cantidad >= MAX_EVIDENCIAS_POR_DISPUTA) {
    return NextResponse.json(
      { error: `La disputa ya tiene ${MAX_EVIDENCIAS_POR_DISPUTA} pruebas` },
      { status: 409 },
    )
  }

  // Si guardarArchivo() falla y no lo agarramos, Next devuelve un 500 con el
  // body vacío y el cliente no puede mostrar ningún mensaje.
  let urlDeLaPrueba = ''
  try {
    urlDeLaPrueba = await guardarArchivo(`disputas/${disputaId}`, archivo)
  } catch (errorDeArchivo) {
    console.error('Error al guardar la evidencia en public/uploads:', errorDeArchivo)
    return NextResponse.json({ error: 'No se pudo guardar la prueba.' }, { status: 502 })
  }

  const evidencia = await db.evidenciaDisputa.create({
    data: { disputaId, url: urlDeLaPrueba, tipo: 'IMAGEN', orden: cantidad },
  })

  return NextResponse.json({ id: evidencia.id, url: evidencia.url }, { status: 201 })
}

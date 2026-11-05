import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { esImagenReal } from '@/lib/validations/complex'
import { ticketEvidenceSchema, MAX_EVIDENCIAS_POR_TICKET } from '@/lib/validations/ticket'
import { requireRole } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

// El jugador responde (o apela) el ticket subiendo evidencia de que sí jugó.
// Una imagen por request: Vercel corta los bodies de más de 4.5 MB.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('JUGADOR')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: ticketId } = await params

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) {
    return NextResponse.json({ error: 'El ticket no existe' }, { status: 404 })
  }
  if (ticket.jugadorId !== session.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  // Un ticket ya resuelto es el registro de la decisión: no se le agrega nada.
  // Mientras siga PENDIENTE se puede responder, aun pasados los 5 días (apelar).
  if (ticket.estado !== 'PENDIENTE') {
    return NextResponse.json({ error: 'El ticket ya está resuelto' }, { status: 409 })
  }

  const formData = await request.formData()
  const parsed = ticketEvidenceSchema.safeParse({
    archivo: formData.get('archivo'),
    comentario: formData.get('comentario') ?? undefined,
  })
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

  const cantidad = await db.evidenciaTicket.count({ where: { ticketId } })
  if (cantidad >= MAX_EVIDENCIAS_POR_TICKET) {
    return NextResponse.json(
      { error: `El ticket ya tiene ${MAX_EVIDENCIAS_POR_TICKET} pruebas` },
      { status: 409 },
    )
  }

  // Si put() falla y no lo agarramos, Next devuelve un 500 con el body vacío
  // y el cliente no puede mostrar ningún mensaje.
  let urlDeLaPrueba = ''
  try {
    const blob = await put(`tickets/${ticketId}/${archivo.name}`, archivo, {
      access: 'public',
      addRandomSuffix: true,
    })
    urlDeLaPrueba = blob.url
  } catch (errorDeBlob) {
    console.error('Error al subir la evidencia a Vercel Blob:', errorDeBlob)
    return NextResponse.json(
      { error: 'No se pudo guardar la prueba. Revisá BLOB_READ_WRITE_TOKEN.' },
      { status: 502 },
    )
  }

  // La respuesta queda registrada en el ticket: marca que el jugador respondió
  // (para que el admin lo vea en su inicio) y guarda su último comentario.
  await db.$transaction([
    db.evidenciaTicket.create({
      data: { ticketId, url: urlDeLaPrueba, tipo: 'IMAGEN', orden: cantidad },
    }),
    db.ticket.update({
      where: { id: ticketId },
      data: {
        respondidoEn: new Date(),
        comentarioJugador: parsed.data.comentario ?? ticket.comentarioJugador,
      },
    }),
  ])

  return NextResponse.json({ ok: true }, { status: 201 })
}

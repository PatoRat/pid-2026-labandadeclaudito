import { NextResponse } from 'next/server'
import { complexImageSchema, esImagenReal, MAX_IMAGES_PER_COMPLEX } from '@/lib/validations/complex'
import { requireRole } from '@/lib/auth-helpers'
import { getComplexByOwner } from '@/lib/ownership'
import { guardarArchivo } from '@/lib/archivos'
import { db } from '@/lib/db'

// Se sube una foto por request: Vercel corta los bodies de más de 4.5 MB.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error, status } = await requireRole('DUENIO')
  if (!session) return NextResponse.json({ error }, { status })

  const { id: complejoId } = await params

  const complejo = await getComplexByOwner(complejoId, session.user.id)
  if (!complejo) {
    return NextResponse.json({ error: 'Complejo no encontrado' }, { status: 404 })
  }

  const formData = await request.formData()
  const parsed = complexImageSchema.safeParse({ imagen: formData.get('imagen') })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const bytes = new Uint8Array(await parsed.data.imagen.arrayBuffer())
  if (!esImagenReal(bytes)) {
    return NextResponse.json({ error: 'Solo se aceptan fotos JPG, PNG o WebP.' }, { status: 400 })
  }

  const cantidadDeFotos = await db.imagenComplejo.count({ where: { complejoId, activo: true } })
  if (cantidadDeFotos >= MAX_IMAGES_PER_COMPLEX) {
    return NextResponse.json({ error: 'El complejo ya tiene 5 fotos' }, { status: 409 })
  }

  const archivo = parsed.data.imagen

  // Si guardarArchivo() falla y no lo agarramos, Next devuelve un 500 con el
  // body vacío y el cliente no puede mostrar ningún mensaje.
  let urlDeLaFoto = ''
  try {
    urlDeLaFoto = await guardarArchivo(`complejos/${complejoId}`, archivo)
  } catch (error) {
    console.error('Error al guardar la foto en public/uploads:', error)
    return NextResponse.json({ error: 'No se pudo guardar la foto.' }, { status: 502 })
  }

  // No se usa la cantidad como orden: al quitar fotos quedan huecos y se repetiría
  const ultimaFoto = await db.imagenComplejo.findFirst({
    where: { complejoId },
    orderBy: { orden: 'desc' },
  })
  const orden = ultimaFoto ? ultimaFoto.orden + 1 : 0

  const imagen = await db.imagenComplejo.create({
    data: { complejoId, url: urlDeLaFoto, orden },
  })

  return NextResponse.json({ id: imagen.id, url: imagen.url }, { status: 201 })
}

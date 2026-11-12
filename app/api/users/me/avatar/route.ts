import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { avatarSchema } from '@/lib/validations/user'
import { esImagenReal } from '@/lib/validations/complex'
import { db } from '@/lib/db'
import { borrarArchivo, guardarArchivo } from '@/lib/archivos'

// Subir (o reemplazar) la foto de perfil
export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (session.user.rol === 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const formData = await request.formData()
  const parsed = avatarSchema.safeParse({ imagen: formData.get('imagen') })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const archivo = parsed.data.imagen
  const bytes = new Uint8Array(await archivo.arrayBuffer())
  if (!esImagenReal(bytes)) {
    return NextResponse.json({ error: 'Solo se aceptan fotos JPG, PNG o WebP.' }, { status: 400 })
  }

  // Si guardarArchivo() falla y no lo agarramos, Next devuelve un 500 con el
  // body vacío y el cliente no puede mostrar ningún mensaje.
  let urlDeLaFoto = ''
  try {
    urlDeLaFoto = await guardarArchivo(`usuarios/${session.user.id}`, archivo)
  } catch (error) {
    console.error('Error al guardar la foto en public/uploads:', error)
    return NextResponse.json({ error: 'No se pudo guardar la foto.' }, { status: 502 })
  }

  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { imagenUrl: true },
  })

  await db.usuario.update({
    where: { id: session.user.id },
    data: { imagenUrl: urlDeLaFoto },
  })

  // La anterior ya no la usa nadie
  if (usuario?.imagenUrl) {
    await borrarArchivo(usuario.imagenUrl)
  }

  return NextResponse.json({ url: urlDeLaFoto }, { status: 201 })
}

// Quitar la foto de perfil: vuelven las iniciales
export async function DELETE() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { imagenUrl: true },
  })
  if (!usuario?.imagenUrl) {
    return NextResponse.json({ error: 'No tenés foto de perfil' }, { status: 404 })
  }

  await db.usuario.update({
    where: { id: session.user.id },
    data: { imagenUrl: null },
  })
  await borrarArchivo(usuario.imagenUrl)

  return NextResponse.json({ ok: true }, { status: 200 })
}

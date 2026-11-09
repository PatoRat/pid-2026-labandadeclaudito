import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// En este fork las fotos se guardan en el disco, en public/uploads/, en vez de
// en Vercel Blob: así el proyecto anda local sin token de ningún servicio.
// OJO: en Vercel esto NO funcionaría — el filesystem es de solo lectura en
// runtime y se pierde en cada deploy. Es una decisión para practicar local.
const CARPETA_PUBLIC = path.join(process.cwd(), 'public')

// Guarda el archivo en public/uploads/<carpeta>/ y devuelve la URL con la que
// el navegador lo va a pedir. Esa URL es la que se guarda en la base.
export async function guardarArchivo(carpeta: string, archivo: File): Promise<string> {
  // Nombre nuevo siempre: dos personas pueden subir "foto.png" y no se tienen
  // que pisar (es lo que hacía addRandomSuffix en Vercel Blob).
  const extension = path.extname(archivo.name).toLowerCase() || '.jpg'
  const nombre = `${randomUUID()}${extension}`

  const destino = path.join(CARPETA_PUBLIC, 'uploads', carpeta)
  await mkdir(destino, { recursive: true })

  const bytes = new Uint8Array(await archivo.arrayBuffer())
  await writeFile(path.join(destino, nombre), bytes)

  return `/uploads/${carpeta}/${nombre}`
}

// Borra un archivo que ya no usa nadie. Las fotos del seed son de Unsplash, no
// nuestras: se saltean. Si el borrado falla, el pedido ya hizo su trabajo en la
// base: se loguea y sigue, en vez de responder 500 con los cambios guardados.
export async function borrarArchivo(url: string) {
  if (!url.startsWith('/uploads/')) return
  try {
    await unlink(path.join(CARPETA_PUBLIC, url))
  } catch (error) {
    console.error('No se pudo borrar el archivo:', url, error)
  }
}

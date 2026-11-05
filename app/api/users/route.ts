import { NextResponse } from 'next/server'
import { Prisma } from '@/lib/generated/prisma/client'
import { auth } from '@/auth'
import { registerSchema } from '@/lib/validations/user'
import { hashPassword } from '@/lib/passwords'
import { db } from '@/lib/db'
import {
  ipDelPedido,
  registrarIntento,
  REGISTRO_POR_IP,
  superoElLimite,
} from '@/lib/limite-intentos'

// Mínimo de caracteres antes de empezar a sugerir: con menos la búsqueda
// devolvería medio padrón y no sirve para autocompletar.
const MIN_CARACTERES_BUSQUEDA = 3

// Busca jugadores por nombre de display (no por email) para el autocompletado
// del etiquetado de amigos. Requiere sesión y nunca devuelve el email ni datos
// sensibles: solo lo que se muestra en la sugerencia.
export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < MIN_CARACTERES_BUSQUEDA) {
    return NextResponse.json({ usuarios: [] }, { status: 200 })
  }

  const usuarios = await db.usuario.findMany({
    where: {
      rol: 'JUGADOR',
      activo: true,
      nombre: { contains: q, mode: 'insensitive' },
      id: { not: session.user.id },
    },
    select: { id: true, nombre: true, imagenUrl: true },
    orderBy: { nombre: 'asc' },
    take: 8,
  })

  return NextResponse.json({ usuarios }, { status: 200 })
}

export async function POST(request: Request) {
  // Se cuenta cada intento de registro, salga bien o no: frena la creación
  // masiva de cuentas y probar emails para ver cuáles ya existen.
  const clave = `registro:${ipDelPedido(request)}`
  if (await superoElLimite(clave, REGISTRO_POR_IP)) {
    return NextResponse.json(
      { error: 'Demasiados registros desde esta conexión. Probá de nuevo en una hora.' },
      { status: 429 },
    )
  }

  const body = await request.json()

  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  await registrarIntento(clave)
  const passwordHash = await hashPassword(parsed.data.password)

  try {
    await db.usuario.create({
      data: {
        nombre: parsed.data.nombre,
        email: parsed.data.email,
        passwordHash: passwordHash,
        rol: parsed.data.rol,
      },
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    // El email es único en la DB: si ya existe, el índice único lo corta.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ese email ya tiene una cuenta' }, { status: 409 })
    }
    throw e
  }
}

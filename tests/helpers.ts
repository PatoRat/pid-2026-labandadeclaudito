import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/passwords'
import { diaDeHoy } from '@/lib/time'
import { guardarSesion } from './sesion'

// Todo lo que crean los tests usa este dominio: la limpieza borra solo eso.
const DOMINIO_DE_TEST = '@tocayjuga.test'

type UsuarioDeTest = {
  id: string
  nombre: string
  email: string
  rol: 'JUGADOR' | 'DUENIO' | 'ADMIN'
}

export function emailDeTest() {
  return `test-${randomUUID()}${DOMINIO_DE_TEST}`
}

export async function crearUsuario(rol: 'JUGADOR' | 'DUENIO' | 'ADMIN') {
  const usuario = await db.usuario.create({
    data: {
      nombre: `${rol} de test`,
      email: emailDeTest(),
      passwordHash: await hashPassword('password123'),
      rol,
    },
  })
  return usuario
}

export function loginComo(usuario: UsuarioDeTest) {
  guardarSesion({
    user: { id: usuario.id, name: usuario.nombre, email: usuario.email, rol: usuario.rol },
  })
}

export function sinSesion() {
  guardarSesion(null)
}

export function jsonRequest(method: string, body?: unknown) {
  return new Request('http://localhost/test', {
    method,
    // IP distinta por pedido: que los tests no choquen con el límite de
    // registros por IP (lib/limite-intentos.ts)
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `test-${randomUUID()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function imagenRequest(archivo: File) {
  const formData = new FormData()
  formData.append('imagen', archivo)
  return new Request('http://localhost/test', { method: 'POST', body: formData })
}

// Arranca con la firma de un PNG: el endpoint mira los primeros bytes
// (esImagenReal), no alcanza con el type.
const FIRMA_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

export function archivoImagen(tipo = 'image/png') {
  return new File([FIRMA_PNG, 'contenido de prueba'], 'foto.png', { type: tipo })
}

// En Next 16 los params de un endpoint llegan como promesa
export function conParams<T>(params: T) {
  return { params: Promise.resolve(params) }
}

function sumarDias(dias: number) {
  const fecha = new Date(`${diaDeHoy()}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export function diaEnNDias(dias: number) {
  return sumarDias(dias)
}

export function diaDeManiana() {
  return sumarDias(1)
}

export function diaDeAyer() {
  return sumarDias(-1)
}

export const datosDeComplejo = {
  nombre: '[TEST] Complejo de prueba',
  direccion: 'Calle Falsa 123',
  // Tiene que ser una zona de la lista fija (lib/zonas.ts): createComplexSchema
  // ya no acepta texto libre.
  zona: 'Palermo',
  contacto: '11 4589-2231',
  porcentajeSenaDefault: 30,
  minAdvanceMinutesDefault: 0,
  cancellationHours: 24,
}

export const datosDeCanchas = {
  nombrePrefijo: 'Cancha',
  cantidad: 2,
  deporte: 'FUTBOL_5',
  tipoSuperficie: 'CESPED_SINTETICO',
  precioBase: 10000,
  horaApertura: '08:00',
  horaCierre: '12:00',
  duracionTurnoMin: 60,
  capacidad: 10,
}

// Crea directo en la DB un complejo con 2 canchas (08 a 12 hs, turnos de 1 hora)
export async function crearComplejoConCanchas(duenioId: string) {
  // Aprobado: los tests que buscan y reservan necesitan un complejo visible.
  // Los de aprobación lo pasan a PENDIENTE a mano.
  const complejo = await db.complejo.create({
    data: { ...datosDeComplejo, duenioId, estadoAprobacion: 'APROBADO' },
  })
  const cancha1 = await db.cancha.create({
    data: {
      complejoId: complejo.id,
      nombre: 'Cancha 1',
      deporte: 'FUTBOL_5',
      tipoSuperficie: 'CESPED_SINTETICO',
      capacidad: 10,
      precioBase: 10000,
      horaApertura: '08:00',
      horaCierre: '12:00',
      duracionTurnoMin: 60,
    },
  })
  const cancha2 = await db.cancha.create({
    data: {
      complejoId: complejo.id,
      nombre: 'Cancha 2',
      deporte: 'FUTBOL_7',
      tipoSuperficie: 'CEMENTO',
      capacidad: 14,
      precioBase: 15000,
      horaApertura: '08:00',
      horaCierre: '12:00',
      duracionTurnoMin: 60,
    },
  })
  return { complejo, cancha1, cancha2 }
}

export async function limpiarDatosDeTest() {
  // Las IPs de test empiezan con "test-" (ver jsonRequest)
  await db.intento.deleteMany({ where: { clave: { contains: 'test-' } } })

  const usuarios = await db.usuario.findMany({
    where: { email: { endsWith: DOMINIO_DE_TEST } },
  })
  const idsDeUsuarios: string[] = []
  for (const usuario of usuarios) {
    idsDeUsuarios.push(usuario.id)
  }

  const complejos = await db.complejo.findMany({ where: { duenioId: { in: idsDeUsuarios } } })
  const idsDeComplejos: string[] = []
  for (const complejo of complejos) {
    idsDeComplejos.push(complejo.id)
  }

  const canchas = await db.cancha.findMany({ where: { complejoId: { in: idsDeComplejos } } })
  const idsDeCanchas: string[] = []
  for (const cancha of canchas) {
    idsDeCanchas.push(cancha.id)
  }

  // Orden de borrado según las FK: primero lo que apunta a otras tablas
  await db.calificacion.deleteMany({
    where: {
      OR: [{ jugadorId: { in: idsDeUsuarios } }, { complejoId: { in: idsDeComplejos } }],
    },
  })
  await db.reserva.deleteMany({
    where: { OR: [{ jugadorId: { in: idsDeUsuarios } }, { canchaId: { in: idsDeCanchas } }] },
  })
  await db.block.deleteMany({ where: { courtId: { in: idsDeCanchas } } })
  await db.imagenComplejo.deleteMany({ where: { complejoId: { in: idsDeComplejos } } })
  await db.cancha.deleteMany({ where: { id: { in: idsDeCanchas } } })
  await db.complejo.deleteMany({ where: { id: { in: idsDeComplejos } } })
  await db.usuario.deleteMany({ where: { id: { in: idsDeUsuarios } } })
}

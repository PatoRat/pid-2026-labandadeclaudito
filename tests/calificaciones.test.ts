import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { POST as calificar } from '@/app/api/bookings/[id]/rating/route'
import { db } from '@/lib/db'
import {
  conParams,
  crearComplejoConCanchas,
  crearUsuario,
  diaEnNDias,
  jsonRequest,
  limpiarDatosDeTest,
  loginComo,
  sinSesion,
} from './helpers'

type Usuario = Awaited<ReturnType<typeof crearUsuario>>

let duenio: Usuario
let jugador: Usuario
let otroJugador: Usuario
let complejoId: string
let canchaId: string

// Una Reserva es única por cancha + fecha + hora de inicio, así que cada
// reserva de test va a un día distinto para no chocar entre tests.
let diasCorridos = 0

async function crearReserva(
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA',
  asistio: boolean | null,
  enElFuturo = false,
) {
  diasCorridos = diasCorridos + 1
  const dias = enElFuturo ? diasCorridos : -diasCorridos
  const reserva = await db.reserva.create({
    data: {
      canchaId,
      jugadorId: jugador.id,
      fecha: new Date(`${diaEnNDias(dias)}T00:00:00Z`),
      horaInicio: '10:00',
      horaFin: '11:00',
      estado,
      asistio,
      precioTurno: 10000,
    },
  })
  return reserva.id
}

function pedirCalificar(reservaId: string, body: unknown) {
  return calificar(jsonRequest('POST', body), conParams({ id: reservaId }))
}

beforeAll(async () => {
  await limpiarDatosDeTest()
  duenio = await crearUsuario('DUENIO')
  jugador = await crearUsuario('JUGADOR')
  otroJugador = await crearUsuario('JUGADOR')
  const { complejo, cancha1 } = await crearComplejoConCanchas(duenio.id)
  complejoId = complejo.id
  canchaId = cancha1.id
})

afterAll(async () => {
  sinSesion()
  await limpiarDatosDeTest()
})

describe('Calificar un complejo (POST /api/bookings/[id]/rating)', () => {
  test('sin sesión devuelve 401', async () => {
    sinSesion()
    const id = await crearReserva('CONFIRMADA', null)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(401)
  })

  test('un dueño no puede calificar', async () => {
    loginComo(duenio)
    const id = await crearReserva('CONFIRMADA', null)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(403)
  })

  test('una reserva que no existe devuelve 404', async () => {
    loginComo(jugador)
    const res = await pedirCalificar('no-existe', { puntaje: 5 })
    expect(res.status).toBe(404)
  })

  test('el puntaje tiene que ser un entero de 1 a 5', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', null)
    for (const puntaje of [0, 6, 3.5, '4', null]) {
      const res = await pedirCalificar(id, { puntaje })
      expect(res.status).toBe(400)
    }
  })

  test('no se puede calificar la reserva de otro jugador', async () => {
    loginComo(otroJugador)
    const id = await crearReserva('CONFIRMADA', null)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(403)
  })

  test('un turno que todavía no se jugó no se califica', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', null, true)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(409)
  })

  test('una reserva cancelada no se califica', async () => {
    loginComo(jugador)
    const id = await crearReserva('CANCELADA', null)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(409)
  })

  test('una reserva que nunca pagó la seña no se califica', async () => {
    loginComo(jugador)
    const id = await crearReserva('PENDIENTE', null)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(409)
  })

  test('con un no-show no se califica', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', false)
    const res = await pedirCalificar(id, { puntaje: 5 })
    expect(res.status).toBe(409)
  })

  test('un turno jugado se califica y queda guardado con su complejo', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', true)
    const res = await pedirCalificar(id, { puntaje: 4, comentario: '  Muy buen césped  ' })
    expect(res.status).toBe(201)

    const guardada = await db.calificacion.findUnique({
      where: { reservaId_jugadorId: { reservaId: id, jugadorId: jugador.id } },
    })
    expect(guardada?.puntaje).toBe(4)
    expect(guardada?.complejoId).toBe(complejoId)
    expect(guardada?.comentario).toBe('Muy buen césped')
  })

  test('si el dueño no marcó la asistencia, también se califica', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', null)
    const res = await pedirCalificar(id, { puntaje: 3 })
    expect(res.status).toBe(201)

    const guardada = await db.calificacion.findFirst({ where: { reservaId: id } })
    expect(guardada?.comentario).toBeNull()
  })

  test('un comentario vacío se guarda como sin comentario', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', null)
    const res = await pedirCalificar(id, { puntaje: 3, comentario: '   ' })
    expect(res.status).toBe(201)

    const guardada = await db.calificacion.findFirst({ where: { reservaId: id } })
    expect(guardada?.comentario).toBeNull()
  })

  test('se califica una sola vez por reserva', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', null)
    const primera = await pedirCalificar(id, { puntaje: 5 })
    expect(primera.status).toBe(201)
    const segunda = await pedirCalificar(id, { puntaje: 1 })
    expect(segunda.status).toBe(409)
  })

  test('dos pedidos a la vez: entra uno solo', async () => {
    loginComo(jugador)
    const id = await crearReserva('CONFIRMADA', null)
    const respuestas = await Promise.all([
      pedirCalificar(id, { puntaje: 5 }),
      pedirCalificar(id, { puntaje: 4 }),
    ])
    const estados = respuestas.map((res) => res.status).sort()
    expect(estados).toEqual([201, 409])
    expect(await db.calificacion.count({ where: { reservaId: id } })).toBe(1)
  })

  test('el que se sumó al partido también califica, aparte del que reservó', async () => {
    const id = await crearReserva('CONFIRMADA', null)
    await db.participanteReserva.create({
      data: { reservaId: id, jugadorId: otroJugador.id, jugadores: 2 },
    })

    loginComo(otroJugador)
    const delSumado = await pedirCalificar(id, { puntaje: 2 })
    expect(delSumado.status).toBe(201)

    loginComo(jugador)
    const delCreador = await pedirCalificar(id, { puntaje: 5 })
    expect(delCreador.status).toBe(201)

    expect(await db.calificacion.count({ where: { reservaId: id } })).toBe(2)
  })
})

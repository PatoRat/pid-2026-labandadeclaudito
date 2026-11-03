import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { POST as reservar } from '@/app/api/bookings/route'
import { POST as sumarse } from '@/app/api/bookings/[id]/join/route'
import { getAvailableSlots } from '@/lib/availability'
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

let canchaId: string
let otraCanchaId: string

beforeAll(async () => {
  await limpiarDatosDeTest()
  const duenio = await crearUsuario('DUENIO')
  const { cancha1, cancha2 } = await crearComplejoConCanchas(duenio.id)
  canchaId = cancha1.id
  otraCanchaId = cancha2.id
})

afterAll(async () => {
  sinSesion()
  await limpiarDatosDeTest()
})

// Un jugador nuevo reserva un partido incompleto y devuelve su id
async function partidoIncompleto(
  cancha: string,
  fecha: string,
  horaInicio: string,
  jugadores: number,
) {
  loginComo(await crearUsuario('JUGADOR'))
  const res = await reservar(
    jsonRequest('POST', { canchaId: cancha, fecha, horaInicio, jugadores }),
  )
  expect(res.status).toBe(201)
  return (await res.json()).reserva.id as string
}

async function sumarseA(id: string, jugadores = 1) {
  return sumarse(jsonRequest('POST', { jugadores }), conParams({ id }))
}

describe('Superposición con partidos a los que me sumé', () => {
  test('no puedo reservar ni sumarme a otro partido a la misma hora', async () => {
    const dia = diaEnNDias(3)
    const partido = await partidoIncompleto(canchaId, dia, '09:00', 6)
    const otroPartido = await partidoIncompleto(otraCanchaId, dia, '09:00', 6)

    const yo = await crearUsuario('JUGADOR')
    loginComo(yo)
    expect((await sumarseA(partido)).status).toBe(200)

    // Sumarme a otro partido a la misma hora
    expect((await sumarseA(otroPartido)).status).toBe(409)

    // Reservar otra cancha a la misma hora
    const res = await reservar(
      jsonRequest('POST', { canchaId: otraCanchaId, fecha: dia, horaInicio: '09:00' }),
    )
    expect(res.status).toBe(409)

    // La grilla tampoco me ofrece ese turno
    const grilla = await getAvailableSlots(otraCanchaId, new Date(dia), yo.id)
    const turno = grilla?.slots.find((slot) => slot.horaInicio === '09:00')
    expect(turno?.puedeUnirse).toBe(false)
  })
})

describe('Dos jugadores sumándose a la vez', () => {
  test('con lugar para uno solo, entra uno y el otro recibe 409', async () => {
    // Fútbol 5: con 8 cargados quedan 2 lugares; cada uno quiere sumar 2
    const partido = await partidoIncompleto(canchaId, diaEnNDias(4), '10:00', 8)

    const primero = await crearUsuario('JUGADOR')
    const segundo = await crearUsuario('JUGADOR')
    // Cada pedido lee la sesión apenas arranca (antes de su primer await), así
    // que se puede cambiar de usuario entre uno y otro sin esperar
    loginComo(primero)
    const pedidoDelPrimero = sumarseA(partido, 2)
    loginComo(segundo)
    const pedidoDelSegundo = sumarseA(partido, 2)

    const estados = (await Promise.all([pedidoDelPrimero, pedidoDelSegundo]))
      .map((res) => res.status)
      .sort()
    expect(estados).toEqual([200, 409])

    const final = await db.reserva.findUnique({
      where: { id: partido },
      include: { participantes: true },
    })
    expect(final?.jugadores).toBe(10)
    expect(final?.participantes).toHaveLength(1)
  })
})

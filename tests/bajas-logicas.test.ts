import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { del } from '@vercel/blob'
import { PATCH as editarComplejo, DELETE as bajaComplejo } from '@/app/api/complexes/[id]/route'
import { POST as subirFoto } from '@/app/api/complexes/[id]/images/route'
import { POST as crearCanchas } from '@/app/api/complexes/[id]/courts/route'
import { PATCH as editarCancha, DELETE as bajaCancha } from '@/app/api/courts/[id]/route'
import { GET as verDisponibilidad } from '@/app/api/courts/[id]/availability/route'
import { POST as reservar } from '@/app/api/bookings/route'
import { POST as pagarSena } from '@/app/api/bookings/[id]/deposit/route'
import { db } from '@/lib/db'
import {
  archivoImagen,
  conParams,
  crearComplejoConCanchas,
  crearUsuario,
  datosDeCanchas,
  datosDeComplejo,
  diaDeAyer,
  diaDeManiana,
  imagenRequest,
  jsonRequest,
  limpiarDatosDeTest,
  loginComo,
  sinSesion,
} from './helpers'

type Usuario = Awaited<ReturnType<typeof crearUsuario>>

let duenio: Usuario
let otroDuenio: Usuario
let jugador: Usuario

beforeAll(async () => {
  await limpiarDatosDeTest()
  duenio = await crearUsuario('DUENIO')
  otroDuenio = await crearUsuario('DUENIO')
  jugador = await crearUsuario('JUGADOR')
})

afterAll(async () => {
  sinSesion()
  await limpiarDatosDeTest()
})

beforeEach(() => {
  vi.mocked(del).mockClear()
})

async function reservarManiana(canchaId: string, horaInicio: string) {
  loginComo(jugador)
  const res = await reservar(jsonRequest('POST', { canchaId, fecha: diaDeManiana(), horaInicio }))
  expect(res.status).toBe(201)
  const json = await res.json()
  return json.reserva.id as string
}

// Una reserva ya jugada no se puede crear por el endpoint: se inserta directo
async function crearReservaPasada(canchaId: string) {
  const cancha = await db.cancha.findUniqueOrThrow({ where: { id: canchaId } })
  const reserva = await db.reserva.create({
    data: {
      canchaId,
      jugadorId: jugador.id,
      fecha: new Date(diaDeAyer()),
      horaInicio: '10:00',
      horaFin: '11:00',
      estado: 'CONFIRMADA',
      precioTurno: cancha.precioBase,
    },
  })
  return reserva.id
}

describe('Baja lógica de una cancha (DELETE /api/courts/[id])', () => {
  let canchaId: string
  let otraCanchaId: string
  let reservaFuturaId: string
  let reservaPasadaId: string

  beforeAll(async () => {
    const { cancha1, cancha2 } = await crearComplejoConCanchas(duenio.id)
    canchaId = cancha1.id
    otraCanchaId = cancha2.id
    reservaFuturaId = await reservarManiana(canchaId, '09:00')
    reservaPasadaId = await crearReservaPasada(canchaId)

    // La reservada para mañana paga la seña, con una política de una semana:
    // si cancelara el jugador no se le devolvería.
    await db.complejo.update({
      where: { id: cancha1.complejoId },
      data: { cancellationHours: 168 },
    })
    loginComo(jugador)
    const pago = await pagarSena(jsonRequest('POST'), conParams({ id: reservaFuturaId }))
    expect(pago.status).toBe(200)
  })

  test('otro dueño no puede darla de baja (404)', async () => {
    loginComo(otroDuenio)
    const res = await bajaCancha(jsonRequest('DELETE'), conParams({ id: canchaId }))
    expect(res.status).toBe(404)
  })

  test('el dueño la da de baja aunque tenga reservas: cancela solo las futuras', async () => {
    loginComo(duenio)
    const res = await bajaCancha(jsonRequest('DELETE'), conParams({ id: canchaId }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.reservasCanceladas).toBe(1)

    const cancha = await db.cancha.findUnique({ where: { id: canchaId } })
    expect(cancha).not.toBeNull()
    expect(cancha?.activo).toBe(false)

    const reservaFutura = await db.reserva.findUnique({
      where: { id: reservaFuturaId },
      include: { pago: true },
    })
    expect(reservaFutura?.estado).toBe('CANCELADA')
    // La canceló el dueño: la seña se devuelve sin mirar la política.
    expect(reservaFutura?.pago?.devuelto).toBe(true)

    const reservaPasada = await db.reserva.findUnique({ where: { id: reservaPasadaId } })
    expect(reservaPasada?.estado).toBe('CONFIRMADA')
  })

  test('la otra cancha del complejo sigue activa', async () => {
    const otraCancha = await db.cancha.findUnique({ where: { id: otraCanchaId } })
    expect(otraCancha?.activo).toBe(true)
  })

  test('la cancha dada de baja ya no se puede usar (404)', async () => {
    loginComo(jugador)
    const disponibilidad = await verDisponibilidad(
      new Request(`http://localhost/test?fecha=${diaDeManiana()}`),
      conParams({ id: canchaId }),
    )
    expect(disponibilidad.status).toBe(404)

    const reserva = await reservar(
      jsonRequest('POST', { canchaId, fecha: diaDeManiana(), horaInicio: '11:00' }),
    )
    expect(reserva.status).toBe(404)

    loginComo(duenio)
    const edicion = await editarCancha(
      jsonRequest('PATCH', {
        nombre: 'No debería',
        deporte: 'FUTBOL_5',
        tipoSuperficie: 'CEMENTO',
        precioBase: 1,
        horaApertura: '08:00',
        horaCierre: '12:00',
        duracionTurnoMin: 60,
        capacidad: 10,
      }),
      conParams({ id: canchaId }),
    )
    expect(edicion.status).toBe(404)

    const segundaBaja = await bajaCancha(jsonRequest('DELETE'), conParams({ id: canchaId }))
    expect(segundaBaja.status).toBe(404)
  })
})

describe('Baja lógica de un complejo (DELETE /api/complexes/[id])', () => {
  let complejoId: string
  let idsDeCanchas: string[]
  let idsDeReservasFuturas: string[]
  let reservaPasadaId: string

  beforeAll(async () => {
    const { complejo, cancha1, cancha2 } = await crearComplejoConCanchas(duenio.id)
    complejoId = complejo.id
    idsDeCanchas = [cancha1.id, cancha2.id]

    loginComo(duenio)
    const foto = await subirFoto(imagenRequest(archivoImagen()), conParams({ id: complejoId }))
    expect(foto.status).toBe(201)

    idsDeReservasFuturas = [
      await reservarManiana(cancha1.id, '08:00'),
      await reservarManiana(cancha2.id, '09:00'),
    ]
    reservaPasadaId = await crearReservaPasada(cancha1.id)
  })

  test('otro dueño no puede darlo de baja (404) y no cambia nada', async () => {
    loginComo(otroDuenio)
    const res = await bajaComplejo(jsonRequest('DELETE'), conParams({ id: complejoId }))
    expect(res.status).toBe(404)

    const complejo = await db.complejo.findUnique({ where: { id: complejoId } })
    expect(complejo?.activo).toBe(true)
  })

  test('el dueño lo da de baja: complejo, canchas y fotos inactivos, reservas futuras canceladas', async () => {
    loginComo(duenio)
    const res = await bajaComplejo(jsonRequest('DELETE'), conParams({ id: complejoId }))
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.reservasCanceladas).toBe(2)

    const complejo = await db.complejo.findUnique({ where: { id: complejoId } })
    expect(complejo?.activo).toBe(false)

    const canchas = await db.cancha.findMany({ where: { id: { in: idsDeCanchas } } })
    expect(canchas.length).toBe(2)
    for (const cancha of canchas) {
      expect(cancha.activo).toBe(false)
    }

    const fotos = await db.imagenComplejo.findMany({ where: { complejoId } })
    expect(fotos.length).toBe(1)
    expect(fotos[0].activo).toBe(false)

    for (const reservaId of idsDeReservasFuturas) {
      const reserva = await db.reserva.findUnique({ where: { id: reservaId } })
      expect(reserva?.estado).toBe('CANCELADA')
    }

    const reservaPasada = await db.reserva.findUnique({ where: { id: reservaPasadaId } })
    expect(reservaPasada?.estado).toBe('CONFIRMADA')
  })

  test('las fotos no se borran de Vercel Blob (para poder reactivar)', () => {
    expect(del).not.toHaveBeenCalled()
  })

  test('el complejo dado de baja ya no se puede operar (404)', async () => {
    loginComo(duenio)

    const edicion = await editarComplejo(
      jsonRequest('PATCH', datosDeComplejo),
      conParams({ id: complejoId }),
    )
    expect(edicion.status).toBe(404)

    const canchaNueva = await crearCanchas(
      jsonRequest('POST', datosDeCanchas),
      conParams({ id: complejoId }),
    )
    expect(canchaNueva.status).toBe(404)

    const fotoNueva = await subirFoto(imagenRequest(archivoImagen()), conParams({ id: complejoId }))
    expect(fotoNueva.status).toBe(404)

    const segundaBaja = await bajaComplejo(jsonRequest('DELETE'), conParams({ id: complejoId }))
    expect(segundaBaja.status).toBe(404)

    loginComo(jugador)
    const reserva = await reservar(
      jsonRequest('POST', {
        canchaId: idsDeCanchas[0],
        fecha: diaDeManiana(),
        horaInicio: '11:00',
      }),
    )
    expect(reserva.status).toBe(404)
  })
})

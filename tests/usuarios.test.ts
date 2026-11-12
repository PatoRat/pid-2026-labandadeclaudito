import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { borrarArchivo, guardarArchivo } from '@/lib/archivos'
import { POST as registrarUsuario } from '@/app/api/users/route'
import { PATCH as editarPerfil } from '@/app/api/users/me/route'
import { POST as subirFoto, DELETE as quitarFoto } from '@/app/api/users/me/avatar/route'
import { db } from '@/lib/db'
import { verifyPassword } from '@/lib/passwords'
import {
  archivoImagen,
  crearUsuario,
  emailDeTest,
  imagenRequest,
  jsonRequest,
  limpiarDatosDeTest,
  loginComo,
  sinSesion,
} from './helpers'

type Usuario = Awaited<ReturnType<typeof crearUsuario>>

let jugador: Usuario
let otroJugador: Usuario
let admin: Usuario

beforeAll(async () => {
  await limpiarDatosDeTest()
  jugador = await crearUsuario('JUGADOR')
  otroJugador = await crearUsuario('JUGADOR')
  admin = await crearUsuario('ADMIN')
})

beforeEach(() => {
  vi.mocked(guardarArchivo).mockClear()
  vi.mocked(borrarArchivo).mockClear()
})

afterAll(async () => {
  await limpiarDatosDeTest()
})

describe('Registro de usuarios (POST /api/users)', () => {
  test('registra un jugador y guarda el password hasheado', async () => {
    const email = emailDeTest()
    const res = await registrarUsuario(
      jsonRequest('POST', {
        nombre: 'Jugador Nuevo',
        email,
        password: 'password123',
        rol: 'JUGADOR',
      }),
    )
    expect(res.status).toBe(201)

    const usuario = await db.usuario.findUnique({ where: { email } })
    expect(usuario?.rol).toBe('JUGADOR')
    expect(usuario?.passwordHash).not.toBe('password123')
    expect(await verifyPassword('password123', usuario!.passwordHash)).toBe(true)
  })

  test('registra un dueño', async () => {
    const email = emailDeTest()
    const res = await registrarUsuario(
      jsonRequest('POST', {
        nombre: 'Dueño Nuevo',
        email,
        password: 'password123',
        rol: 'DUENIO',
      }),
    )
    expect(res.status).toBe(201)

    const usuario = await db.usuario.findUnique({ where: { email } })
    expect(usuario?.rol).toBe('DUENIO')
  })

  test('no deja registrar dos veces el mismo email (409)', async () => {
    const datos = {
      nombre: 'Repetido',
      email: emailDeTest(),
      password: 'password123',
      rol: 'JUGADOR',
    }
    const primera = await registrarUsuario(jsonRequest('POST', datos))
    expect(primera.status).toBe(201)

    const segunda = await registrarUsuario(jsonRequest('POST', datos))
    expect(segunda.status).toBe(409)
  })

  test('rechaza datos inválidos (400)', async () => {
    const passwordCorto = await registrarUsuario(
      jsonRequest('POST', {
        nombre: 'Test',
        email: emailDeTest(),
        password: '123',
        rol: 'JUGADOR',
      }),
    )
    expect(passwordCorto.status).toBe(400)

    const rolInexistente = await registrarUsuario(
      jsonRequest('POST', {
        nombre: 'Test',
        email: emailDeTest(),
        password: 'password123',
        rol: 'ADMIN',
      }),
    )
    expect(rolInexistente.status).toBe(400)
  })
})

const datosDePerfil = {
  nombre: 'Juan Pérez',
  email: '',
  telefono: '11 4589-2231',
  dni: '38124567',
}

describe('Editar el propio perfil (PATCH /api/users/me)', () => {
  test('el jugador cambia sus datos', async () => {
    loginComo(jugador)
    const res = await editarPerfil(jsonRequest('PATCH', { ...datosDePerfil, email: jugador.email }))
    expect(res.status).toBe(200)

    const guardado = await db.usuario.findUnique({ where: { id: jugador.id } })
    expect(guardado?.nombre).toBe('Juan Pérez')
    expect(guardado?.telefono).toBe('11 4589-2231')
    expect(guardado?.dni).toBe('38124567')
  })

  test('el teléfono y el DNI vacíos quedan en null', async () => {
    loginComo(jugador)
    const res = await editarPerfil(
      jsonRequest('PATCH', {
        nombre: 'Juan Pérez',
        email: jugador.email,
        telefono: null,
        dni: null,
      }),
    )
    expect(res.status).toBe(200)

    const guardado = await db.usuario.findUnique({ where: { id: jugador.id } })
    expect(guardado?.telefono).toBeNull()
    expect(guardado?.dni).toBeNull()
  })

  test('edita al usuario de la sesión, no al que venga en el body', async () => {
    loginComo(jugador)
    const res = await editarPerfil(
      jsonRequest('PATCH', {
        ...datosDePerfil,
        email: jugador.email,
        nombre: 'Nombre del impostor',
        // el endpoint no mira ningún id del body
        id: otroJugador.id,
      }),
    )
    expect(res.status).toBe(200)

    const victima = await db.usuario.findUnique({ where: { id: otroJugador.id } })
    expect(victima?.nombre).not.toBe('Nombre del impostor')
  })

  test('no deja usar el email de otro usuario (409)', async () => {
    loginComo(jugador)
    const res = await editarPerfil(
      jsonRequest('PATCH', { ...datosDePerfil, email: otroJugador.email }),
    )
    expect(res.status).toBe(409)

    const sigueIgual = await db.usuario.findUnique({ where: { id: jugador.id } })
    expect(sigueIgual?.email).toBe(jugador.email)
  })

  test('rechaza datos inválidos (400)', async () => {
    loginComo(jugador)

    const nombreCorto = await editarPerfil(
      jsonRequest('PATCH', { ...datosDePerfil, email: jugador.email, nombre: 'J' }),
    )
    expect(nombreCorto.status).toBe(400)

    const emailInvalido = await editarPerfil(
      jsonRequest('PATCH', { ...datosDePerfil, email: 'no-es-un-email' }),
    )
    expect(emailInvalido.status).toBe(400)

    const dniConLetras = await editarPerfil(
      jsonRequest('PATCH', { ...datosDePerfil, email: jugador.email, dni: '38.124.567' }),
    )
    expect(dniConLetras.status).toBe(400)
  })

  test('el admin no tiene perfil para editar (403)', async () => {
    loginComo(admin)
    const res = await editarPerfil(jsonRequest('PATCH', { ...datosDePerfil, email: admin.email }))
    expect(res.status).toBe(403)

    const sigueIgual = await db.usuario.findUnique({ where: { id: admin.id } })
    expect(sigueIgual?.nombre).not.toBe('Juan Pérez')
  })

  test('sin sesión no se puede editar (401)', async () => {
    sinSesion()
    const res = await editarPerfil(jsonRequest('PATCH', { ...datosDePerfil, email: jugador.email }))
    expect(res.status).toBe(401)
  })
})

describe('Foto de perfil (/api/users/me/avatar)', () => {
  test('el jugador sube su foto', async () => {
    loginComo(jugador)
    const res = await subirFoto(imagenRequest(archivoImagen()))
    expect(res.status).toBe(201)
    expect(guardarArchivo).toHaveBeenCalledTimes(1)

    const guardado = await db.usuario.findUnique({ where: { id: jugador.id } })
    expect(guardado?.imagenUrl).toContain(`usuarios/${jugador.id}/`)
  })

  test('una foto nueva borra la anterior del disco', async () => {
    loginComo(jugador)
    const anterior = await db.usuario.findUnique({ where: { id: jugador.id } })

    const res = await subirFoto(imagenRequest(archivoImagen()))
    expect(res.status).toBe(201)
    expect(borrarArchivo).toHaveBeenCalledWith(anterior!.imagenUrl)
  })

  test('rechaza un archivo que no es imagen (400)', async () => {
    loginComo(jugador)
    const res = await subirFoto(imagenRequest(archivoImagen('text/plain')))
    expect(res.status).toBe(400)
    expect(guardarArchivo).not.toHaveBeenCalled()
  })

  test('quitar la foto la borra de la DB y del disco', async () => {
    loginComo(jugador)
    const conFoto = await db.usuario.findUnique({ where: { id: jugador.id } })

    const res = await quitarFoto()
    expect(res.status).toBe(200)
    expect(borrarArchivo).toHaveBeenCalledWith(conFoto!.imagenUrl)

    const sinFoto = await db.usuario.findUnique({ where: { id: jugador.id } })
    expect(sinFoto?.imagenUrl).toBeNull()
  })

  test('quitar una foto que no existe devuelve 404', async () => {
    loginComo(jugador)
    const res = await quitarFoto()
    expect(res.status).toBe(404)
    expect(borrarArchivo).not.toHaveBeenCalled()
  })

  test('sin sesión no se puede subir foto (401)', async () => {
    sinSesion()
    const res = await subirFoto(imagenRequest(archivoImagen()))
    expect(res.status).toBe(401)
    expect(guardarArchivo).not.toHaveBeenCalled()
  })
})

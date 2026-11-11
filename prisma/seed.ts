// Datos de demo para probar toda la app a mano. Correr con: npm run db:seed
//
// OJO: borra TODA la base (de los 3) antes de cargar los datos de demo. Se
// puede correr las veces que se quiera, siempre deja la base igual.
//
// Las fechas son relativas a hoy, así siempre hay reservas pasadas, en curso
// y futuras. Usuarios: ver el console.log del final.
import 'dotenv/config'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/passwords'
import { precioDelTurno, precioProporcional } from '@/lib/availability'
import { diaDeHoy, diaSemanaDeReserva, generateSlots, momentoActual } from '@/lib/time'
import { Prisma } from '@/lib/generated/prisma/client'
import type { Deporte, TipoSuperficie } from '@/lib/generated/prisma/client'

// ---------- Helpers ----------

// Día YYYY-MM-DD a N días de hoy (negativo = pasado)
function dia(diasDesdeHoy: number): string {
  const fecha = new Date(`${diaDeHoy()}T00:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + diasDesdeHoy)
  return fecha.toISOString().slice(0, 10)
}

function foto(id: string): string {
  return `https://images.unsplash.com/${id}?w=1200&q=80`
}

// Orden según las FK: primero lo que apunta a otras tablas. Pago, fotos,
// precios especiales y bloqueos caen en cascada igual, pero así se lee claro.
async function borrarTodo() {
  await db.pago.deleteMany()
  await db.reserva.deleteMany()
  await db.block.deleteMany()
  await db.precioEspecial.deleteMany()
  await db.imagenComplejo.deleteMany()
  await db.cancha.deleteMany()
  await db.complejo.deleteMany()
  await db.usuario.deleteMany()
}

async function crearUsuario(
  nombre: string,
  email: string,
  password: string,
  rol: 'JUGADOR' | 'DUENIO' | 'ADMIN',
  dni: string,
  telefono: string,
) {
  return db.usuario.create({
    data: {
      nombre,
      email,
      passwordHash: await hashPassword(password),
      rol,
      dni,
      telefono,
    },
  })
}

type DatosDeCancha = {
  nombre: string
  deporte: Deporte
  tipoSuperficie: TipoSuperficie
  capacidad: number
  precioBase: number
  horaApertura: string
  horaCierre: string
  duracionTurnoMin: number
  porcentajeSena?: number
  minAdvanceMinutes?: number
  activo?: boolean
}

async function crearCancha(complejoId: string, datos: DatosDeCancha) {
  return db.cancha.create({ data: { complejoId, ...datos } })
}

type OpcionesDeReserva = {
  canchaId: string
  jugadorId: string
  diasDesdeHoy: number
  horaInicio: string
  estado: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA'
  // Solo para turnos ya jugados: true = asistió, false = no se presentó
  asistio?: boolean
  // CONFIRMADA siempre tiene seña. CANCELADA puede tener o no.
  sena?: 'pagada' | 'devuelta' | 'no devuelta'
  // Para que el precio congelado sea distinto del precio actual de la cancha
  precioCongelado?: number
  // Política de cancelación congelada en el Pago (si no, la del complejo)
  horasDeCancelacionAlPagar?: number
  // Cuándo se pidió la reserva (importa para el plazo de 15 min de la seña)
  creadaHaceMinutos?: number
}

// Crea la reserva con el mismo cálculo de precio y seña que los endpoints
// (POST /api/bookings y POST /api/bookings/[id]/deposit).
async function crearReserva(opciones: OpcionesDeReserva) {
  const cancha = await db.cancha.findUniqueOrThrow({
    where: { id: opciones.canchaId },
    include: { complejo: true, preciosEspeciales: { where: { activo: true } } },
  })

  const fecha = new Date(dia(opciones.diasDesdeHoy))
  const turnos = generateSlots(cancha.horaApertura, cancha.horaCierre, cancha.duracionTurnoMin)
  const turno = turnos.find((t) => t.horaInicio === opciones.horaInicio)
  if (!turno) {
    throw new Error(`${opciones.horaInicio} no es un turno de ${cancha.nombre}`)
  }

  let precioTurno = precioProporcional(
    precioDelTurno(
      cancha.precioBase,
      cancha.preciosEspeciales,
      diaSemanaDeReserva(fecha),
      turno.horaInicio,
    ),
    turno.horaInicio,
    turno.horaFin,
    cancha.duracionTurnoMin,
  )
  if (opciones.precioCongelado !== undefined) {
    precioTurno = new Prisma.Decimal(opciones.precioCongelado)
  }

  const minutos = opciones.creadaHaceMinutos ?? 60 * 24 * 3
  const reserva = await db.reserva.create({
    data: {
      canchaId: cancha.id,
      jugadorId: opciones.jugadorId,
      fecha,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      estado: opciones.estado,
      asistio: opciones.asistio ?? null,
      precioTurno,
      createdAt: new Date(Date.now() - minutos * 60 * 1000),
    },
  })

  if (opciones.sena) {
    const porcentaje = cancha.porcentajeSena ?? cancha.complejo.porcentajeSenaDefault
    await db.pago.create({
      data: {
        reservaId: reserva.id,
        monto: precioTurno.mul(porcentaje).div(100),
        porcentaje,
        cancellationHours: opciones.horasDeCancelacionAlPagar ?? cancha.complejo.cancellationHours,
        devuelto: opciones.sena === 'devuelta',
      },
    })
  }

  return reserva
}

// ---------- Seed ----------

async function main() {
  await borrarTodo()

  // ----- Usuarios -----
  // Dos dueños de complejos y dos jugadores. Todos con el mismo dominio y
  // numerados, así se sabe de memoria con qué entrar.
  const duenio1 = await crearUsuario(
    'Martín Gómez',
    'dueno1@tocayjuga.com',
    'Dueno1234',
    'DUENIO',
    '30111222',
    '11 4775-1234',
  )
  const duenio2 = await crearUsuario(
    'Laura Fernández',
    'dueno2@tocayjuga.com',
    'Dueno1234',
    'DUENIO',
    '31222333',
    '11 4983-5566',
  )
  const jugador1 = await crearUsuario(
    'Juan Pérez',
    'jugador1@tocayjuga.com',
    'Jugador1234',
    'JUGADOR',
    '40111222',
    '11 6000-1111',
  )
  const jugador2 = await crearUsuario(
    'Camila Rodríguez',
    'jugador2@tocayjuga.com',
    'Jugador1234',
    'JUGADOR',
    '41222333',
    '11 6000-2222',
  )

  // Administrador de la plataforma: no se puede registrar desde el form,
  // solo existe si lo crea el seed
  await crearUsuario(
    'Admin TocaYJuga',
    'admin@tocayjuga.com',
    'Admin1234',
    'ADMIN',
    '20000000',
    '11 4000-0000',
  )

  // ----- Complejo 1: Palermo (dueno1@tocayjuga.com) -----
  // Seña 30%, reservar con 3 hs de anticipación, cancelar con 24 hs
  const palermo = await db.complejo.create({
    data: {
      nombre: 'La Canchita de Palermo',
      direccion: 'Av. Santa Fe 4321',
      zona: 'Palermo',
      contacto: '11 4775-1234',
      duenioId: duenio1.id,
      estadoAprobacion: 'APROBADO',
      porcentajeSenaDefault: 30,
      minAdvanceMinutesDefault: 180,
      cancellationHours: 24,
      imagenes: {
        create: [
          { url: foto('photo-1529900748604-07564a03e7a6'), orden: 0 },
          { url: foto('photo-1575361204480-aadea25e6e68'), orden: 1 },
          { url: foto('photo-1551958219-acbc608c6377'), orden: 2 },
        ],
      },
    },
  })
  const palermo1 = await crearCancha(palermo.id, {
    nombre: 'Cancha 1',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CESPED_SINTETICO',
    capacidad: 10,
    precioBase: 28000,
    horaApertura: '09:00',
    horaCierre: '00:00',
    duracionTurnoMin: 60,
  })
  const palermo2 = await crearCancha(palermo.id, {
    nombre: 'Cancha 2',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CESPED_SINTETICO',
    capacidad: 10,
    precioBase: 28000,
    horaApertura: '09:00',
    horaCierre: '00:00',
    duracionTurnoMin: 60,
  })
  const palermo3 = await crearCancha(palermo.id, {
    nombre: 'Cancha 3',
    deporte: 'FUTBOL_7',
    tipoSuperficie: 'CESPED_SINTETICO',
    capacidad: 14,
    precioBase: 42000,
    horaApertura: '09:00',
    horaCierre: '00:00',
    duracionTurnoMin: 60,
  })

  // Precios especiales: los tres niveles de especificidad (franja > día > base)
  await db.precioEspecial.createMany({
    data: [
      // Todos los días de 19 a 23: horario nocturno más caro
      {
        canchaId: palermo1.id,
        diaSemana: null,
        horaInicio: '19:00',
        horaFin: '23:00',
        precio: 35000,
      },
      // Sábado y domingo todo el día
      { canchaId: palermo1.id, diaSemana: 6, horaInicio: null, horaFin: null, precio: 32000 },
      { canchaId: palermo1.id, diaSemana: 0, horaInicio: null, horaFin: null, precio: 32000 },
      // Viernes a la noche, solo la de 7
      { canchaId: palermo3.id, diaSemana: 5, horaInicio: '18:00', horaFin: '23:00', precio: 50000 },
      // Un precio dado de baja: no tiene que aplicarse
      {
        canchaId: palermo2.id,
        diaSemana: null,
        horaInicio: '09:00',
        horaFin: '12:00',
        precio: 15000,
        activo: false,
      },
    ],
  })

  // Bloqueos: uno próximo de varios días, uno de un día entero y uno pasado
  await db.block.createMany({
    data: [
      {
        courtId: palermo1.id,
        startDate: new Date(dia(5)),
        endDate: new Date(dia(7)),
        startTime: '09:00',
        endTime: '13:00',
        reason: 'Resembrado del césped',
      },
      {
        courtId: palermo3.id,
        startDate: new Date(dia(12)),
        endDate: new Date(dia(12)),
        startTime: '09:00',
        endTime: '23:00',
        reason: 'Torneo interno',
      },
      {
        courtId: palermo2.id,
        startDate: new Date(dia(-10)),
        endDate: new Date(dia(-8)),
        startTime: '09:00',
        endTime: '12:00',
        reason: 'Cambio de luces',
      },
    ],
  })

  // ----- Complejo 2: Villa Urquiza (dueno1@tocayjuga.com) -----
  // Seña 50%, sin anticipación mínima, cancelar con 48 hs
  const urquiza = await db.complejo.create({
    data: {
      nombre: 'Club Atlético Villa Urquiza',
      direccion: 'Av. Triunvirato 4950',
      zona: 'Villa Urquiza',
      contacto: '11 4521-9090',
      duenioId: duenio1.id,
      estadoAprobacion: 'APROBADO',
      porcentajeSenaDefault: 50,
      minAdvanceMinutesDefault: 0,
      cancellationHours: 48,
      imagenes: {
        create: [
          { url: foto('photo-1459865264687-595d652de67e'), orden: 0 },
          { url: foto('photo-1554068865-24cecd4e34b8'), orden: 1 },
          { url: foto('photo-1626224583764-f87db24ac4ea'), orden: 2 },
        ],
      },
    },
  })
  // 10 a 21 con turnos de 90 min: 7 turnos completos + uno de 30 min (20:30)
  // que cobra 1/3 del precio
  const urquizaF11 = await crearCancha(urquiza.id, {
    nombre: 'Cancha Principal',
    deporte: 'FUTBOL_11',
    tipoSuperficie: 'CESPED_NATURAL',
    capacidad: 22,
    precioBase: 90000,
    horaApertura: '10:00',
    horaCierre: '21:00',
    duracionTurnoMin: 90,
  })
  const urquizaTenis1 = await crearCancha(urquiza.id, {
    nombre: 'Tenis 1',
    deporte: 'TENIS',
    tipoSuperficie: 'POLVO_DE_LADRILLO',
    capacidad: 4,
    precioBase: 18000,
    horaApertura: '08:00',
    horaCierre: '22:00',
    duracionTurnoMin: 60,
  })
  const urquizaTenis2 = await crearCancha(urquiza.id, {
    nombre: 'Tenis 2',
    deporte: 'TENIS',
    tipoSuperficie: 'POLVO_DE_LADRILLO',
    capacidad: 4,
    precioBase: 18000,
    horaApertura: '08:00',
    horaCierre: '22:00',
    duracionTurnoMin: 60,
  })
  // Pisa la seña (20%) y la anticipación (1 hora) del complejo
  const urquizaPadel = await crearCancha(urquiza.id, {
    nombre: 'Pádel Techado',
    deporte: 'PADEL',
    tipoSuperficie: 'CEMENTO',
    capacidad: 4,
    precioBase: 24000,
    horaApertura: '08:00',
    horaCierre: '00:00',
    duracionTurnoMin: 90,
    porcentajeSena: 20,
    minAdvanceMinutes: 60,
  })

  // ----- Complejo 3: Caballito (dueno2@tocayjuga.com) -----
  // Seña 25%, 2 hs de anticipación, cancelar con 12 hs
  const caballito = await db.complejo.create({
    data: {
      nombre: 'Polideportivo Caballito',
      direccion: 'Av. Rivadavia 5200',
      zona: 'Caballito',
      contacto: '11 4983-5566',
      duenioId: duenio2.id,
      estadoAprobacion: 'APROBADO',
      porcentajeSenaDefault: 25,
      minAdvanceMinutesDefault: 120,
      cancellationHours: 12,
      imagenes: {
        create: [
          { url: foto('photo-1546519638-68e109498ffc'), orden: 0 },
          { url: foto('photo-1574629810360-7efbbe195018'), orden: 1 },
        ],
      },
    },
  })
  const caballitoBasquet = await crearCancha(caballito.id, {
    nombre: 'Cancha de Básquet',
    deporte: 'BASQUET',
    tipoSuperficie: 'PARQUET',
    capacidad: 10,
    precioBase: 30000,
    horaApertura: '08:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60,
  })
  // Apertura igual al cierre = abierta las 24 hs
  const caballito24 = await crearCancha(caballito.id, {
    nombre: 'Fútbol 5 Techado 24 hs',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CEMENTO',
    capacidad: 10,
    precioBase: 26000,
    horaApertura: '00:00',
    horaCierre: '00:00',
    duracionTurnoMin: 60,
    minAdvanceMinutes: 0,
  })
  // Cierra pasada la medianoche (18 a 02)
  const caballitoNocturna = await crearCancha(caballito.id, {
    nombre: 'Fútbol 5 Nocturna',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CESPED_SINTETICO',
    capacidad: 10,
    precioBase: 27000,
    horaApertura: '18:00',
    horaCierre: '02:00',
    duracionTurnoMin: 60,
  })

  // ----- Complejo 4: Olivos (dueno2@tocayjuga.com) -----
  const olivos = await db.complejo.create({
    data: {
      nombre: 'Fútbol Norte Olivos',
      direccion: 'Av. Maipú 2800',
      zona: 'Olivos',
      contacto: '11 4799-3030',
      duenioId: duenio2.id,
      estadoAprobacion: 'APROBADO',
      porcentajeSenaDefault: 30,
      minAdvanceMinutesDefault: 180,
      cancellationHours: 24,
      imagenes: {
        create: [
          { url: foto('photo-1431324155629-1a6deb1dec8d'), orden: 0 },
          { url: foto('photo-1522778119026-d647f0596c20'), orden: 1 },
        ],
      },
    },
  })
  const olivosA = await crearCancha(olivos.id, {
    nombre: 'Cancha A',
    deporte: 'FUTBOL_7',
    tipoSuperficie: 'CESPED_SINTETICO',
    capacidad: 14,
    precioBase: 40000,
    horaApertura: '09:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60,
  })
  await crearCancha(olivos.id, {
    nombre: 'Cancha B',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CESPED_NATURAL',
    capacidad: 10,
    precioBase: 25000,
    horaApertura: '09:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60,
  })
  // Cancha dada de baja: no aparece en la búsqueda, pero su reserva vieja
  // sigue en el historial
  const olivosCerrada = await crearCancha(olivos.id, {
    nombre: 'Cancha C',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CEMENTO',
    capacidad: 10,
    precioBase: 22000,
    horaApertura: '09:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60,
    activo: false,
  })

  // ----- Complejo 5: dado de baja (dueno2@tocayjuga.com) -----
  const boedo = await db.complejo.create({
    data: {
      nombre: 'Complejo Boedo',
      direccion: 'Av. Boedo 1450',
      zona: 'Boedo',
      contacto: '11 4932-1212',
      duenioId: duenio2.id,
      estadoAprobacion: 'APROBADO',
      activo: false,
    },
  })
  const boedoCancha = await crearCancha(boedo.id, {
    nombre: 'Cancha Única',
    deporte: 'FUTBOL_5',
    tipoSuperficie: 'CESPED_SINTETICO',
    capacidad: 10,
    precioBase: 20000,
    horaApertura: '10:00',
    horaCierre: '23:00',
    duracionTurnoMin: 60,
    activo: false,
  })

  // ----- Reservas de jugador1@tocayjuga.com: una de cada estado -----
  // Ya jugada, asistió
  await crearReserva({
    canchaId: palermo1.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: -14,
    horaInicio: '20:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    asistio: true,
  })
  // Ya jugada, no se presentó (seña perdida)
  await crearReserva({
    canchaId: urquizaTenis1.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: -7,
    horaInicio: '18:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    asistio: false,
  })
  // Ya jugada sin marcar asistencia: dueno1@tocayjuga.com la puede marcar
  await crearReserva({
    canchaId: palermo3.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: -2,
    horaInicio: '21:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // En curso ahora mismo (cancha 24 hs, turno de la hora actual)
  const horaActual = momentoActual().hora.slice(0, 2) + ':00'
  await crearReserva({
    canchaId: caballito24.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: 0,
    horaInicio: horaActual,
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // Futura con más de 24 hs: al cancelar se devuelve la seña. Además el jugador no
  // puede reservar otra cancha ese día a las 20 (superposición)
  await crearReserva({
    canchaId: palermo1.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: 3,
    horaInicio: '20:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // Mañana en un complejo de 48 hs: al cancelar NO se devuelve la seña.
  // Pagó cuando la política era de 72 hs: vale la más corta (48)
  await crearReserva({
    canchaId: urquizaF11.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: 1,
    horaInicio: '17:30',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    horasDeCancelacionAlPagar: 72,
  })
  // Pendiente de seña recién pedida: hay 15 minutos para pagarla
  await crearReserva({
    canchaId: olivosA.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: 2,
    horaInicio: '19:00',
    estado: 'PENDIENTE',
    creadaHaceMinutos: 0,
  })
  // Canceladas: con seña devuelta, con seña perdida y sin seña
  await crearReserva({
    canchaId: palermo2.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: -5,
    horaInicio: '19:00',
    estado: 'CANCELADA',
    sena: 'devuelta',
  })
  await crearReserva({
    canchaId: urquizaPadel.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: -3,
    horaInicio: '20:00',
    estado: 'CANCELADA',
    sena: 'no devuelta',
  })
  await crearReserva({
    canchaId: caballitoBasquet.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: 5,
    horaInicio: '19:00',
    estado: 'CANCELADA',
  })
  // En el complejo dado de baja: una jugada y una futura cancelada por la baja
  await crearReserva({
    canchaId: boedoCancha.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: -20,
    horaInicio: '21:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    asistio: true,
  })
  await crearReserva({
    canchaId: boedoCancha.id,
    jugadorId: jugador1.id,
    diasDesdeHoy: 4,
    horaInicio: '21:00',
    estado: 'CANCELADA',
    sena: 'devuelta',
  })

  // ----- Reservas de jugador2@tocayjuga.com -----
  // Turno nocturno con precio especial de franja
  await crearReserva({
    canchaId: palermo1.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 1,
    horaInicio: '21:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // Turno que termina a medianoche
  await crearReserva({
    canchaId: caballitoNocturna.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 2,
    horaInicio: '23:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // Turno corto de 30 min: precio proporcional
  await crearReserva({
    canchaId: urquizaF11.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 6,
    horaInicio: '20:30',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // Precio congelado más barato que el actual de la cancha
  await crearReserva({
    canchaId: palermo1.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 10,
    horaInicio: '20:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    precioCongelado: 30000,
  })
  await crearReserva({
    canchaId: caballitoBasquet.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: -1,
    horaInicio: '20:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    asistio: true,
  })
  // En la cancha dada de baja de Olivos
  await crearReserva({
    canchaId: olivosCerrada.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: -6,
    horaInicio: '20:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    asistio: true,
  })
  // Pendiente vencida (pedida hace 1 hora): no se muestra ni ocupa el turno,
  // y se borra con el próximo POST /api/bookings
  await crearReserva({
    canchaId: palermo3.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 4,
    horaInicio: '20:00',
    estado: 'PENDIENTE',
    creadaHaceMinutos: 60,
  })

  await crearReserva({
    canchaId: palermo1.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: -14,
    horaInicio: '21:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
    asistio: true,
  })
  // Otra sin marcar asistencia, para dueno1@tocayjuga.com
  await crearReserva({
    canchaId: palermo2.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: -1,
    horaInicio: '18:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  await crearReserva({
    canchaId: palermo2.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 1,
    horaInicio: '20:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  await crearReserva({
    canchaId: urquizaTenis2.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: 2,
    horaInicio: '10:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })
  // Sin marcar asistencia, para dueno2@tocayjuga.com
  await crearReserva({
    canchaId: caballitoNocturna.id,
    jugadorId: jugador2.id,
    diasDesdeHoy: -3,
    horaInicio: '22:00',
    estado: 'CONFIRMADA',
    sena: 'pagada',
  })

  console.log(`
Seed listo (se borró todo lo que había antes).

  DUEÑOS (Dueno1234)
  dueno1@tocayjuga.com    La Canchita de Palermo + Club Atlético Villa Urquiza
  dueno2@tocayjuga.com    Polideportivo Caballito + Fútbol Norte Olivos + Complejo Boedo (de baja)

  JUGADORES (Jugador1234)
  jugador1@tocayjuga.com  una reserva de cada estado (la pendiente vence en 15 min)
  jugador2@tocayjuga.com  turnos nocturnos, turno corto, precio congelado

  ADMIN (Admin1234)
  admin@tocayjuga.com     usuarios, aprobar complejos, disputas y tickets
`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, ChevronRight, Store, User, UserX } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { grupoDelEstado, reservasDiaPorDia, resumirReservas, tasa } from '@/lib/admin-bookings'
import type { ReservaResumida } from '@/lib/admin-bookings'
import { pendientesVencidas } from '@/lib/bookings'
import { complejoPorAprobar, complejoVisible } from '@/lib/complejos'
import { variacionPorcentual } from '@/lib/dashboard'
import { estadoDeReserva } from '@/lib/estado-reserva'
import { diaEnPalabras, haceCuanto, saludoSegunHora } from '@/lib/fechas'
import { homePorRol } from '@/lib/home-por-rol'
import { diaDeHoy, diaDeReserva, momentoActual, sumarDias } from '@/lib/time'
import { ParaResolver } from '@/components/para-resolver'
import { ReservasPorDia } from '@/components/reservas-por-dia'
import { VariationBadge } from '@/components/variation-badge'

function altasDeLaSemana(nuevos: number): string {
  if (nuevos === 0) return 'Sin altas en la última semana'
  return `+${nuevos} en la última semana`
}

// El inicio del admin muestra solo lo que le sirve para decidir: lo que
// espera una decisión suya, si la plataforma anda bien y quiénes la usan.
// El detalle vive en cada página (Reservas, Usuarios, Disputas).
export default async function AdminHomePage() {
  // El proxy ya filtra por rol, pero la página lo vuelve a chequear
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol !== 'ADMIN') redirect(homePorRol(session.user.rol))

  // Se comparan los últimos 7 días (con hoy) contra los 7 anteriores
  const hoy = diaDeHoy()
  const inicioDeLaSemana = sumarDias(hoy, -6)
  const inicioDeLaAnterior = sumarDias(hoy, -13)
  // Medianoche en Argentina (UTC-3, sin horario de verano), para comparar
  // contra createdAt, que es un instante y no un día
  const inicioDeLaSemanaComoInstante = new Date(`${inicioDeLaSemana}T00:00:00-03:00`)

  // Las consultas no dependen entre sí: se hacen a la vez
  const [
    disputasAbiertas,
    disputaMasVieja,
    reservasDeDosSemanas,
    jugadores,
    jugadoresNuevos,
    duenios,
    complejosActivos,
    cuentasSuspendidas,
    complejosPorAprobar,
    complejoMasViejo,
    ticketsPorResolver,
    ticketMasViejo,
  ] = await Promise.all([
    db.disputa.count({ where: { estado: 'ABIERTA' } }),
    db.disputa.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    // Solo lo que hace falta para saber el estado de cada una
    db.reserva.findMany({
      where: {
        fecha: { gte: new Date(inicioDeLaAnterior), lte: new Date(hoy) },
        NOT: pendientesVencidas(),
      },
      select: { estado: true, asistio: true, fecha: true, horaInicio: true, horaFin: true },
    }),
    db.usuario.count({ where: { rol: 'JUGADOR', activo: true } }),
    db.usuario.count({
      where: { rol: 'JUGADOR', activo: true, createdAt: { gte: inicioDeLaSemanaComoInstante } },
    }),
    db.usuario.count({ where: { rol: 'DUENIO', activo: true } }),
    // Solo los que ven los jugadores: aprobados y de un dueño no suspendido
    db.complejo.count({ where: complejoVisible() }),
    db.usuario.count({ where: { activo: false } }),
    db.complejo.count({ where: complejoPorAprobar() }),
    db.complejo.findFirst({
      where: complejoPorAprobar(),
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    // Tickets que el jugador ya respondió y esperan la decisión del admin
    db.ticket.count({ where: { estado: 'PENDIENTE', respondidoEn: { not: null } } }),
    db.ticket.findFirst({
      where: { estado: 'PENDIENTE', respondidoEn: { not: null } },
      orderBy: { respondidoEn: 'asc' },
      select: { respondidoEn: true },
    }),
  ])

  // En curso, Finalizada y No se presentó salen del reloj: se calculan acá
  const ahora = momentoActual()
  const reservas: ReservaResumida[] = []
  for (const reserva of reservasDeDosSemanas) {
    const dia = diaDeReserva(reserva.fecha)
    const estado = estadoDeReserva(
      {
        estado: reserva.estado,
        asistio: reserva.asistio,
        dia,
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
      },
      ahora,
    )
    reservas.push({ dia, grupo: grupoDelEstado(estado) })
  }

  const deLaSemana: ReservaResumida[] = []
  const deLaAnterior: ReservaResumida[] = []
  for (const reserva of reservas) {
    if (reserva.dia >= inicioDeLaSemana) {
      deLaSemana.push(reserva)
    } else {
      deLaAnterior.push(reserva)
    }
  }

  const semana = resumirReservas(deLaSemana)
  const anterior = resumirReservas(deLaAnterior)
  const totalesPorDia = reservasDiaPorDia(reservas, inicioDeLaAnterior, 14)

  // Señales de que algo anda mal: muchas cancelaciones (un complejo con
  // problemas) o muchas ausencias (que terminan en disputas). Las tasas no
  // llevan variación en %: "+20%" sobre un 10% confunde.
  const alertas = [
    {
      label: 'Cancelaciones',
      valor: tasa(semana.canceladas, semana.total),
      antes: tasa(anterior.canceladas, anterior.total),
      detalle: `${semana.canceladas} de ${semana.total} reservas`,
    },
    {
      label: 'Ausencias',
      valor: tasa(semana.ausentes, semana.terminadas),
      antes: tasa(anterior.ausentes, anterior.terminadas),
      detalle: `${semana.ausentes} de ${semana.terminadas} turnos jugados`,
    },
  ]

  const pendientes = disputasAbiertas + complejosPorAprobar + ticketsPorResolver
  let bajada = 'Está todo al día: no hay nada esperando tu decisión.'
  if (pendientes === 1) {
    bajada = 'Hay 1 inconveniente esperando tu decisión.'
  } else if (pendientes > 1) {
    bajada = `Hay ${pendientes} inconvenientes esperando tu decisión.`
  }

  let antiguedadDeLaDisputa = ''
  if (disputaMasVieja !== null) {
    const diaDeLaDisputa = momentoActual(disputaMasVieja.createdAt).dia
    antiguedadDeLaDisputa = haceCuanto(diaDeLaDisputa, hoy)
  }

  let antiguedadDelComplejo = ''
  if (complejoMasViejo !== null) {
    const diaDelComplejo = momentoActual(complejoMasViejo.createdAt).dia
    antiguedadDelComplejo = haceCuanto(diaDelComplejo, hoy)
  }

  let antiguedadDelTicket = ''
  if (ticketMasViejo?.respondidoEn != null) {
    const diaDelTicket = momentoActual(ticketMasViejo.respondidoEn).dia
    antiguedadDelTicket = haceCuanto(diaDelTicket, hoy)
  }

  // Cada fila lleva al listado que la detalla
  const comunidad = [
    {
      label: jugadores === 1 ? 'Jugador' : 'Jugadores',
      valor: jugadores,
      detalle: altasDeLaSemana(jugadoresNuevos),
      icono: User,
      color: 'bg-primary/15 text-primary',
      href: '/admin/usuarios?rol=JUGADOR',
    },
    {
      label: duenios === 1 ? 'Dueño' : 'Dueños',
      valor: duenios,
      detalle: `${complejosActivos} ${complejosActivos === 1 ? 'complejo activo' : 'complejos activos'}`,
      icono: Store,
      color: 'bg-clay/15 text-clay-foreground',
      href: '/admin/usuarios?rol=DUENIO',
    },
    {
      label: cuentasSuspendidas === 1 ? 'Cuenta suspendida' : 'Cuentas suspendidas',
      valor: cuentasSuspendidas,
      detalle: 'No pueden iniciar sesión',
      icono: UserX,
      color: 'bg-muted text-muted-foreground',
      href: '/admin/usuarios?filtro=suspendidas',
    },
  ]

  const primerNombre = (session.user.name ?? '').split(' ')[0]

  return (
    <div>
      <div className="mb-7">
        <p className="text-muted-foreground text-sm font-medium">{diaEnPalabras(hoy)}</p>
        <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight">
          ¡{saludoSegunHora()}, {primerNombre}!
        </h1>
        <p className="text-muted-foreground mt-1.5">{bajada}</p>
      </div>

      <ParaResolver
        disputasAbiertas={disputasAbiertas}
        antiguedadDeLaDisputa={antiguedadDeLaDisputa}
        complejosPorAprobar={complejosPorAprobar}
        antiguedadDelComplejo={antiguedadDelComplejo}
        ticketsPorResolver={ticketsPorResolver}
        antiguedadDelTicket={antiguedadDelTicket}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Si la plataforma anda bien: la última semana contra la anterior */}
        <section className="bg-card shadow-card min-w-0 rounded-3xl p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div>
              <h2 className="font-heading text-xl font-bold">Actividad</h2>
              <p className="text-muted-foreground text-sm">
                Últimos 7 días, comparados con los 7 anteriores
              </p>
            </div>
            <Link
              href="/admin/reservas"
              className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Ver reservas
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-semibold">Reservas</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-heading text-5xl font-bold tracking-tight tabular-nums">
                  {semana.reservas.toLocaleString('es-AR')}
                </span>
                <VariationBadge
                  variacion={variacionPorcentual(semana.reservas, anterior.reservas)}
                  subirEsBueno
                />
              </div>
              <p className="text-muted-foreground mt-1 text-sm">Sin contar las canceladas</p>

              <div className="border-border mt-5 grid grid-cols-2 gap-5 border-t pt-5">
                {alertas.map((alerta) => (
                  <div key={alerta.label} className="min-w-0">
                    <p className="text-sm font-semibold">{alerta.label}</p>
                    <p className="mt-0.5 flex items-baseline gap-2">
                      <span className="font-heading text-2xl font-bold tabular-nums">
                        {alerta.valor}
                      </span>
                      <span
                        title="El mismo dato en los 7 días anteriores"
                        className="text-muted-foreground text-sm whitespace-nowrap"
                      >
                        antes {alerta.antes}
                      </span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-sm">{alerta.detalle}</p>
                  </div>
                ))}
              </div>
            </div>

            <ReservasPorDia totales={totalesPorDia} desde={inicioDeLaAnterior} />
          </div>
        </section>

        {/* Quiénes usan la plataforma */}
        <section className="bg-card shadow-card flex min-w-0 flex-col rounded-3xl p-7">
          <h2 className="font-heading mb-3 text-xl font-bold">Comunidad</h2>
          {/* Las filas se reparten el alto, que lo marca la tarjeta de Actividad */}
          <ul className="divide-border flex flex-1 flex-col justify-around divide-y">
            {comunidad.map((fila) => {
              const Icono = fila.icono
              return (
                <li key={fila.label}>
                  <Link
                    href={fila.href}
                    className="hover:bg-muted -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors"
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${fila.color}`}
                    >
                      <Icono className="size-4.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{fila.label}</span>
                      <span className="text-muted-foreground block truncate text-sm">
                        {fila.detalle}
                      </span>
                    </span>
                    <span className="font-heading text-2xl font-bold tabular-nums">
                      {fila.valor.toLocaleString('es-AR')}
                    </span>
                    <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

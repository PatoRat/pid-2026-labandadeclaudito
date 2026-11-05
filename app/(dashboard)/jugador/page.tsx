import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Search } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { dondeProximas, pendientesVencidas } from '@/lib/bookings'
import { complejoVisible } from '@/lib/complejos'
import { venceLaSena } from '@/lib/estado-reserva'
import { diaCercano, diaEnPalabras, proximoSabado, saludoSegunHora } from '@/lib/fechas'
import { textoJugadoresFaltantes } from '@/lib/jugadores'
import { getPartidosAbiertos } from '@/lib/partidos-abiertos'
import { estadisticasDelJugador, insigniasGanadas, nivelDe, puntosDe } from '@/lib/gamificacion'
import { getPartidosDeJugadores } from '@/lib/partidos-de-jugadores'
import { getPenalizacionDeJugadores, penalizacionDe } from '@/lib/tickets'
import { diaDeHoy, diaDeReserva, sumarDias } from '@/lib/time'
import { Button } from '@/components/ui/button'
import { EstadoVacio } from '@/components/estado-vacio'
import { CuentaRegresivaSena } from '@/components/cuenta-regresiva-sena'
import { RefreshWhenDepositExpires } from '@/components/refresh-when-deposit-expires'
import { FilaDeTurno } from '@/components/fila-de-turno'
import { ProximoTurnoDestacado } from '@/components/proximo-turno-destacado'
import { TarjetaPartidoAbierto } from '@/components/tarjeta-partido-abierto'
import { TarjetaNivel } from '@/components/tarjeta-nivel'
import { FestejoDeLogros } from '@/components/festejo-de-logros'
import { TicketPendiente } from '@/components/ticket-pendiente'

export default async function JugadorHomePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const hoy = diaDeHoy()
  const sabado = proximoSabado(hoy)

  // Las consultas no dependen entre sí: se hacen a la vez (una sola espera a
  // la base en lugar de varias seguidas).
  const [
    proximasReservas,
    totalProximasReservas,
    totalReservas,
    totalComplejos,
    reservasDelSabado,
    partidosAbiertosTodos,
    partidosPorJugador,
    penalizacionPorJugador,
    ticketsPendientes,
  ] = await Promise.all([
    db.reserva.findMany({
      where: {
        jugadorId: session.user.id,
        ...dondeProximas(),
      },
      include: { cancha: { include: { complejo: true } } },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      take: 3,
    }),
    db.reserva.count({
      where: {
        jugadorId: session.user.id,
        ...dondeProximas(),
      },
    }),
    db.reserva.count({
      where: { jugadorId: session.user.id, NOT: pendientesVencidas() },
    }),
    db.complejo.count({
      where: { ...complejoVisible(), canchas: { some: { activo: true } } },
    }),
    db.reserva.count({
      where: {
        jugadorId: session.user.id,
        fecha: new Date(sabado),
        estado: { not: 'CANCELADA' },
        NOT: pendientesVencidas(),
      },
    }),
    getPartidosAbiertos(session.user.id),
    getPartidosDeJugadores([session.user.id]),
    getPenalizacionDeJugadores([session.user.id]),
    // Tickets de penalización que el jugador todavía tiene que responder o
    // apelar. Los resueltos salen del inicio (quedan en el historial del admin).
    db.ticket.findMany({
      where: { jugadorId: session.user.id, estado: 'PENDIENTE' },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Igual que en el perfil: los puntos del nivel restan la penalización de los
  // tickets; la racha y las insignias salen de los partidos jugados.
  const estadisticas = estadisticasDelJugador(partidosPorJugador.get(session.user.id) ?? [])
  const penalizacion = penalizacionPorJugador.get(session.user.id) ?? 0
  const puntos = Math.max(0, puntosDe(estadisticas) - penalizacion)

  // En el feed se muestran los primeros; el resto se ve en Buscar canchas
  const partidosAbiertos = partidosAbiertosTodos.slice(0, 4)

  // El primero va destacado arriba; los otros dos, como tarjetas debajo.
  const [proximoTurno, ...otrosTurnos] = proximasReservas

  const primerNombre = (session.user.name ?? '').split(' ')[0]

  // Si ya reservó para el sábado, la tarjeta del finde le propone el domingo
  const yaJuegaElSabado = reservasDelSabado > 0
  const domingo = sumarDias(sabado, 1)

  // La frase de arriba cuenta cuándo es el próximo partido
  let bajada = 'Buscá una cancha libre y reservá tu próximo partido.'
  let cuando: 'hoy' | 'mañana' | null = null
  if (proximoTurno !== undefined) {
    const diaDelTurno = diaDeReserva(proximoTurno.fecha)
    const zona = proximoTurno.cancha.complejo.zona
    cuando = diaCercano(diaDelTurno, hoy)
    if (cuando === 'hoy') {
      bajada = `Hoy te toca jugar en ${zona}.`
    } else if (cuando === 'mañana') {
      bajada = `Mañana te toca jugar en ${zona}.`
    } else {
      bajada = `Tu próximo partido es el ${diaEnPalabras(diaDelTurno).toLowerCase()}.`
    }
  }

  const insigniasDelJugador = insigniasGanadas(estadisticas).map((insignia) => ({
    id: insignia.id,
    nombre: insignia.nombre,
  }))

  return (
    <div>
      <FestejoDeLogros
        usuarioId={session.user.id}
        nivel={nivelDe(puntos).actual.nombre}
        insignias={insigniasDelJugador}
      />
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{diaEnPalabras(hoy)}</p>
          <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight">
            ¡{saludoSegunHora()}, {primerNombre}!
          </h1>
          <p className="text-muted-foreground mt-1.5">{bajada}</p>
        </div>
        <Button render={<Link href="/jugador/canchas" />}>
          <Search className="size-4" />
          Buscar canchas
        </Button>
      </div>

      {ticketsPendientes.length > 0 && (
        <div className="mb-7 space-y-4">
          {ticketsPendientes.map((ticket) => (
            <TicketPendiente
              key={ticket.id}
              ticketId={ticket.id}
              motivo={ticket.motivo}
              reservasInvalidas={ticket.reservasInvalidas}
              penalizacion={penalizacionDe(ticket)}
              puntosAnteriores={ticket.puntosAnteriores}
              venceEn={ticket.venceEn.toISOString()}
              yaRespondio={ticket.respondidoEn !== null}
            />
          ))}
        </div>
      )}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* min-w-0: sin esto, en celular la columna se ensancha hasta el texto
            más largo de las filas y la página se desborda de costado */}
        <section className="min-w-0">
          {proximoTurno === undefined ? (
            <EstadoVacio
              titulo="No tenés turnos reservados"
              texto="Elegí un complejo y reservá el horario que te sirva."
            >
              <Button render={<Link href="/jugador/canchas" />}>
                <Search className="size-4" />
                Buscar canchas
              </Button>
            </EstadoVacio>
          ) : (
            <>
              <ProximoTurnoDestacado
                etiqueta={cuando === null ? 'Tu próximo partido' : `Tu próximo partido · ${cuando}`}
                dia={diaDeReserva(proximoTurno.fecha)}
                horaInicio={proximoTurno.horaInicio}
                horaFin={proximoTurno.horaFin}
                cancha={proximoTurno.cancha.nombre}
                deporte={proximoTurno.cancha.deporte}
                lugar={`${proximoTurno.cancha.complejo.nombre} · ${proximoTurno.cancha.complejo.zona}`}
                nota={textoJugadoresFaltantes(
                  proximoTurno.cancha.capacidad,
                  proximoTurno.jugadores,
                )}
              >
                {/* Pendiente de seña: la cuenta regresiva va sobre fondo
                    claro, porque sus colores no se leen sobre el verde */}
                {proximoTurno.estado === 'PENDIENTE' ? (
                  <div className="bg-background text-foreground mt-5 space-y-3 rounded-2xl p-4">
                    <CuentaRegresivaSena
                      venceEn={venceLaSena(proximoTurno.createdAt).toISOString()}
                    />
                    <RefreshWhenDepositExpires
                      venceEn={venceLaSena(proximoTurno.createdAt).toISOString()}
                    />
                    <Button size="sm" render={<Link href="/jugador/reservas" />}>
                      Pagar seña
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    className="mt-5"
                    render={<Link href="/jugador/reservas" />}
                  >
                    Ver mi reserva
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </ProximoTurnoDestacado>

              {otrosTurnos.length > 0 && (
                <>
                  <div className="mt-7 mb-3.5 flex items-baseline justify-between px-1">
                    <h2 className="font-heading text-xl font-bold">Próximas reservas</h2>
                    <Link
                      href="/jugador/reservas"
                      className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold"
                    >
                      Ver todas
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    {otrosTurnos.map((reserva) => (
                      <FilaDeTurno
                        key={reserva.id}
                        href="/jugador/reservas"
                        dia={diaDeReserva(reserva.fecha)}
                        hoy={hoy}
                        horaInicio={reserva.horaInicio}
                        horaFin={reserva.horaFin}
                        deporte={reserva.cancha.deporte}
                        detalle={`${reserva.cancha.nombre} · ${reserva.cancha.complejo.nombre}, ${reserva.cancha.complejo.zona}`}
                        nota={textoJugadoresFaltantes(reserva.cancha.capacidad, reserva.jugadores)}
                      >
                        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
                          <ArrowRight className="size-4" />
                        </span>
                      </FilaDeTurno>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {partidosAbiertos.length > 0 && (
            <>
              <div className="mt-7 mb-3.5 flex items-baseline justify-between px-1">
                <h2 className="font-heading text-xl font-bold">Partidos que buscan jugadores</h2>
                <Link
                  href="/jugador/canchas?incompletas=1"
                  className="text-primary inline-flex items-center gap-1.5 text-sm font-semibold"
                >
                  Ver todos
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {partidosAbiertos.map((reserva) => (
                  <TarjetaPartidoAbierto key={reserva.id} reserva={reserva} />
                ))}
              </div>
            </>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <TarjetaNivel puntos={puntos} racha={estadisticas.rachaSemanas} conLink />

          {/* Un número protagonista y dos de apoyo, en vez de tres tarjetas iguales */}
          <div className="bg-card shadow-card rounded-3xl p-7">
            <p className="text-muted-foreground text-sm font-semibold">Desde que te sumaste</p>
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="font-heading text-primary text-7xl font-extrabold tracking-tighter">
                {totalReservas}
              </span>
              <span className="leading-snug font-semibold">
                {totalReservas === 1 ? 'partido reservado' : 'partidos reservados'}
              </span>
            </div>
            <div className="border-border mt-5 flex gap-5 border-t pt-4">
              <div className="min-w-0 flex-1">
                <p className="font-heading text-2xl font-bold">{totalProximasReservas}</p>
                <p className="text-muted-foreground text-sm">
                  {totalProximasReservas === 1 ? 'próximo turno' : 'próximos turnos'}
                </p>
              </div>
              <div className="border-border min-w-0 flex-1 border-l pl-5">
                <p className="font-heading text-2xl font-bold">{totalComplejos}</p>
                <p className="text-muted-foreground text-sm">complejos para elegir</p>
              </div>
            </div>
          </div>

          <div className="bg-clay/12 rounded-3xl px-7 py-6">
            <p className="font-heading text-xl font-bold">
              {yaJuegaElSabado ? '¿Y el domingo, otro partido?' : '¿Sale partido el finde?'}
            </p>
            <p className="text-foreground/80 mt-1.5 text-sm">
              {yaJuegaElSabado
                ? 'El sábado ya tenés turno. Mirá qué canchas quedan libres el domingo.'
                : 'Mirá qué canchas quedan libres este sábado.'}
            </p>
            <Link
              href={`/jugador/canchas?fecha=${yaJuegaElSabado ? domingo : sabado}`}
              className="text-clay-foreground mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Ver canchas libres
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

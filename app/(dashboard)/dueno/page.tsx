import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Plus } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { dondeProximas } from '@/lib/bookings'
import { diaEnPalabras, saludoSegunHora } from '@/lib/fechas'
import { textoJugadoresFaltantes } from '@/lib/jugadores'
import { iniciales } from '@/lib/iniciales'
import { diaDeHoy, diaDeReserva } from '@/lib/time'
import { Button } from '@/components/ui/button'
import { EstadoVacio } from '@/components/estado-vacio'
import { FilaDeTurno } from '@/components/fila-de-turno'
import { ProximoTurnoDestacado } from '@/components/proximo-turno-destacado'
import { QuienReservo } from '@/components/quien-reservo'

export default async function DuenoHomePage() {
  const session = await auth()
  if (!session) redirect('/login')

  const canchasDelDuenio = { complejo: { duenioId: session.user.id } }

  // Las cuatro consultas no dependen entre sí: se hacen a la vez (una sola
  // espera a la base en lugar de cuatro seguidas).
  const [totalComplejos, totalCanchas, totalProximasReservas, proximasReservas] = await Promise.all(
    [
      db.complejo.count({
        where: { duenioId: session.user.id, activo: true },
      }),
      db.cancha.count({
        where: { activo: true, complejo: { duenioId: session.user.id, activo: true } },
      }),
      db.reserva.count({
        where: {
          cancha: canchasDelDuenio,
          ...dondeProximas(),
        },
      }),
      db.reserva.findMany({
        where: {
          cancha: canchasDelDuenio,
          ...dondeProximas(),
        },
        include: { cancha: { include: { complejo: true } }, jugador: true },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
        take: 5,
      }),
    ],
  )

  // El primero va destacado arriba; los demás, como filas debajo.
  const [proximoTurno, ...otrosTurnos] = proximasReservas

  const primerNombre = (session.user.name ?? '').split(' ')[0]
  const hoy = diaDeHoy()

  let bajada = 'Todavía no tenés turnos reservados.'
  if (totalProximasReservas === 1) {
    bajada = 'Tenés 1 turno reservado de hoy en adelante.'
  } else if (totalProximasReservas > 1) {
    bajada = `Tenés ${totalProximasReservas} turnos reservados de hoy en adelante.`
  }

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{diaEnPalabras(hoy)}</p>
          <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight">
            ¡{saludoSegunHora()}, {primerNombre}!
          </h1>
          <p className="text-muted-foreground mt-1.5">{bajada}</p>
        </div>
        <Button render={<Link href="/dueno/complejos/nuevo" />}>
          <Plus className="size-4" />
          Nuevo complejo
        </Button>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* min-w-0: sin esto, en celular la columna se ensancha hasta el texto
            más largo de las filas y la página se desborda de costado */}
        <section className="min-w-0">
          {proximoTurno === undefined && totalComplejos === 0 && (
            <EstadoVacio
              titulo="Todavía no cargaste ningún complejo"
              texto="Cargá tu complejo y sus canchas para que los jugadores puedan reservar."
            >
              <Button render={<Link href="/dueno/complejos/nuevo" />}>
                <Plus className="size-4" />
                Cargar mi primer complejo
              </Button>
            </EstadoVacio>
          )}

          {proximoTurno === undefined && totalComplejos > 0 && (
            <EstadoVacio
              titulo="Todavía no hay turnos reservados"
              texto="Cuando un jugador reserve una de tus canchas, va a aparecer acá."
            />
          )}

          {proximoTurno !== undefined && (
            <>
              <ProximoTurnoDestacado
                etiqueta="El próximo turno en tus canchas"
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
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <p className="flex items-center gap-2.5">
                    <span className="bg-sidebar/40 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                      {iniciales(proximoTurno.jugador.nombre)}
                    </span>
                    <span>
                      Reservó <span className="font-semibold">{proximoTurno.jugador.nombre}</span>
                    </span>
                  </p>
                  <Button variant="secondary" render={<Link href="/dueno/reservas" />}>
                    Ver reservas
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </ProximoTurnoDestacado>

              {otrosTurnos.length > 0 && (
                <>
                  <div className="mt-7 mb-3.5 flex items-baseline justify-between px-1">
                    <h2 className="font-heading text-xl font-bold">Próximas reservas</h2>
                    <Link
                      href="/dueno/reservas"
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
                        href="/dueno/reservas"
                        dia={diaDeReserva(reserva.fecha)}
                        hoy={hoy}
                        horaInicio={reserva.horaInicio}
                        horaFin={reserva.horaFin}
                        deporte={reserva.cancha.deporte}
                        detalle={`${reserva.cancha.nombre} · ${reserva.cancha.complejo.nombre}`}
                        nota={textoJugadoresFaltantes(reserva.cancha.capacidad, reserva.jugadores)}
                      >
                        <QuienReservo nombre={reserva.jugador.nombre} />
                      </FilaDeTurno>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {/* Un número protagonista y dos de apoyo, en vez de tres tarjetas iguales */}
          <div className="bg-card shadow-card rounded-3xl p-7">
            <p className="text-muted-foreground text-sm font-semibold">De hoy en adelante</p>
            <div className="mt-1.5 flex items-baseline gap-3">
              <span className="font-heading text-primary text-7xl font-extrabold tracking-tighter">
                {totalProximasReservas}
              </span>
              <span className="leading-snug font-semibold">
                {totalProximasReservas === 1 ? 'turno reservado' : 'turnos reservados'}
              </span>
            </div>
            <div className="border-border mt-5 flex gap-5 border-t pt-4">
              <div className="min-w-0 flex-1">
                <p className="font-heading text-2xl font-bold">{totalComplejos}</p>
                <p className="text-muted-foreground text-sm">
                  {totalComplejos === 1 ? 'complejo cargado' : 'complejos cargados'}
                </p>
              </div>
              <div className="border-border min-w-0 flex-1 border-l pl-5">
                <p className="font-heading text-2xl font-bold">{totalCanchas}</p>
                <p className="text-muted-foreground text-sm">
                  {totalCanchas === 1 ? 'cancha en total' : 'canchas en total'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-clay/12 rounded-3xl px-7 py-6">
            <p className="font-heading text-xl font-bold">Canchas, precios y horarios</p>
            <p className="text-foreground/80 mt-1.5 text-sm">
              Sumá canchas, cargá precios especiales o bloqueá horarios desde cada complejo.
            </p>
            <Link
              href="/dueno/complejos"
              className="text-clay-foreground mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              Ir a mis complejos
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}

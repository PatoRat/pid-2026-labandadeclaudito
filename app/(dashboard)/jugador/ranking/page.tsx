import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { PUNTOS, nivelDe, rankingDelMes } from '@/lib/gamificacion'
import { getPartidosDeJugadores } from '@/lib/partidos-de-jugadores'
import { getPenalizacionDeJugadores } from '@/lib/tickets'
import { iniciales } from '@/lib/iniciales'
import { nombresDeMeses } from '@/lib/labels'
import { momentoActual } from '@/lib/time'
import { cn } from '@/lib/utils'
import { SelloDeNivel } from '@/components/sello-de-nivel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { EstadoVacio } from '@/components/estado-vacio'

const LUGARES_A_MOSTRAR = 10

// "Juan Pérez" → "Juan P.": el ranking lo ven todos los jugadores
function nombreCorto(nombre: string) {
  const [primero, segundo] = nombre.split(' ')
  return segundo ? `${primero} ${segundo[0]}.` : primero
}

export default async function RankingPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const ahora = momentoActual()
  const [anio, mes] = ahora.dia.split('-')

  // ponytail: trae todas las reservas de todos los jugadores y suma en memoria.
  // Alcanza para la escala de la demo; si crece, guardar los puntos del mes en
  // una tabla al marcar la asistencia.
  const jugadores = await db.usuario.findMany({
    where: { rol: 'JUGADOR', activo: true },
    select: { id: true, nombre: true, imagenUrl: true },
  })
  const jugadorIds = jugadores.map((jugador) => jugador.id)
  // Medianoche del 1° del mes en Argentina (UTC-3): desde ahí cuentan los
  // tickets que pesan sobre el ranking de este mes.
  const inicioDelMes = new Date(`${ahora.dia.slice(0, 7)}-01T00:00:00-03:00`)
  const [partidos, penalizacionPorJugador, penalizacionDelMesPorJugador] = await Promise.all([
    getPartidosDeJugadores(jugadorIds),
    getPenalizacionDeJugadores(jugadorIds),
    getPenalizacionDeJugadores(jugadorIds, { creadosDesde: inicioDelMes }),
  ])
  const ranking = rankingDelMes(jugadores, partidos, ahora, penalizacionDelMesPorJugador)

  // El nivel que se muestra resta la penalización de los tickets del admin; el
  // orden del mes (puntosDelMes) es solo actividad y no se penaliza.
  function nivelConPenalizacion(id: string, puntosTotales: number) {
    return nivelDe(Math.max(0, puntosTotales - (penalizacionPorJugador.get(id) ?? 0))).actual.nombre
  }

  const fotos = new Map(jugadores.map((jugador) => [jugador.id, jugador.imagenUrl]))
  const miPosicion = ranking.findIndex((fila) => fila.id === session.user.id)
  const yo = ranking[miPosicion]

  return (
    <div>
      <div className="mb-7">
        <p className="text-muted-foreground text-sm font-medium">
          {nombresDeMeses[Number(mes) - 1]} {anio}
        </p>
        <h1 className="font-heading mt-1 text-4xl font-bold tracking-tight">Ranking del mes</h1>
        <p className="text-muted-foreground mt-1.5">
          Cuentan los partidos de este mes. El 1° de cada mes arranca de cero.
        </p>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="min-w-0">
          {ranking.length === 0 ? (
            <EstadoVacio
              titulo="Todavía nadie sumó puntos este mes"
              texto="Jugá un partido o sumate al de otro y arrancás primero."
            >
              <Button render={<Link href="/jugador/canchas" />}>
                <Search className="size-4" />
                Buscar canchas
              </Button>
            </EstadoVacio>
          ) : (
            <ol className="bg-card shadow-card divide-border divide-y overflow-hidden rounded-3xl">
              {ranking.slice(0, LUGARES_A_MOSTRAR).map((fila, i) => {
                const soyYo = fila.id === session.user.id
                return (
                  <li
                    key={fila.id}
                    className={cn('flex items-center gap-3.5 px-5 py-3.5', soyYo && 'bg-accent')}
                  >
                    <span
                      className={cn(
                        'font-heading flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        i === 0 ? 'bg-highlight text-highlight-foreground' : 'bg-muted',
                      )}
                    >
                      {i + 1}
                    </span>
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={fotos.get(fila.id) ?? undefined} alt="" />
                      <AvatarFallback className="bg-primary text-primary-foreground font-heading text-sm font-bold">
                        {iniciales(fila.nombre)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {nombreCorto(fila.nombre)}
                        {soyYo && <span className="text-muted-foreground font-normal"> (vos)</span>}
                      </p>
                      <div className="mt-0.5">
                        <SelloDeNivel nivel={nivelConPenalizacion(fila.id, fila.puntosTotales)} />
                      </div>
                    </div>
                    <p className="font-heading text-primary shrink-0 text-lg font-bold">
                      {fila.puntosDelMes} pts
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <aside className="lg:self-start">
          <div className="bg-card shadow-card rounded-3xl p-7">
            <p className="text-muted-foreground text-sm font-semibold">Tu posición</p>
            {yo ? (
              <>
                <div className="mt-1.5 flex items-baseline gap-2.5">
                  <span className="font-heading text-primary text-7xl font-extrabold tracking-tighter">
                    #{miPosicion + 1}
                  </span>
                  <span className="text-muted-foreground font-semibold">
                    de {ranking.length} {ranking.length === 1 ? 'jugador' : 'jugadores'}
                  </span>
                </div>
                <p className="mt-1 font-semibold">{yo.puntosDelMes} puntos este mes</p>
                {/* El de arriba: cuánto falta para pasarlo (con los mismos
                    puntos queda abajo por nombre, así que hace falta uno más) */}
                {miPosicion > 0 && (
                  <p className="bg-highlight/30 mt-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold">
                    Te faltan {ranking[miPosicion - 1].puntosDelMes - yo.puntosDelMes + 1} pts para
                    pasar a {nombreCorto(ranking[miPosicion - 1].nombre)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-1.5 font-semibold">Todavía no sumaste puntos este mes.</p>
            )}
            <p className="text-muted-foreground mt-3 text-sm">
              Jugar suma {PUNTOS.jugado}, sumarte al partido de otro {PUNTOS.sumado} y publicar un
              partido con cupos libres {PUNTOS.abierto} más. Calificar un complejo suma{' '}
              {PUNTOS.calificar}. Faltar a un turno resta {-PUNTOS.noShow}.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

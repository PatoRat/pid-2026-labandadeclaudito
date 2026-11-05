import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { PerfilForm } from '@/components/perfil-form'
import { TarjetaNivel } from '@/components/tarjeta-nivel'
import { EscaleraDeNiveles } from '@/components/escalera-de-niveles'
import { InsigniasDelJugador } from '@/components/insignias-del-jugador'
import { homePorRol } from '@/lib/home-por-rol'
import { estadisticasDelJugador, puntosDe } from '@/lib/gamificacion'
import { getPartidosDeJugadores } from '@/lib/partidos-de-jugadores'
import { getPenalizacionDeJugadores } from '@/lib/tickets'

// Única pantalla de perfil para jugador y dueño (el proxy deja pasar /perfil
// para cualquier rol). El admin es una cuenta de la app: no tiene perfil.
export default async function PerfilPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol === 'ADMIN') redirect('/admin')

  const esJugador = session.user.rol === 'JUGADOR'
  const [usuario, partidos, penalizacionPorJugador] = await Promise.all([
    db.usuario.findUnique({
      where: { id: session.user.id },
      select: { nombre: true, email: true, telefono: true, dni: true, imagenUrl: true },
    }),
    // El dueño no juega: no tiene nivel ni insignias
    esJugador ? getPartidosDeJugadores([session.user.id]) : null,
    esJugador ? getPenalizacionDeJugadores([session.user.id]) : null,
  ])
  if (!usuario) redirect('/login')

  const estadisticas = partidos ? estadisticasDelJugador(partidos.get(session.user.id) ?? []) : null
  // El nivel resta la penalización de los tickets del admin; las insignias no
  // (se ganan por lo que el jugador hizo, no se sacan).
  const penalizacion = penalizacionPorJugador?.get(session.user.id) ?? 0
  const puntosDelNivel = estadisticas ? Math.max(0, puntosDe(estadisticas) - penalizacion) : 0

  return (
    <main>
      <div className="max-w-3xl">
        <PerfilForm usuario={usuario} volverA={homePorRol(session.user.rol)} />
      </div>

      {estadisticas && (
        <section id="insignias" className="mt-10 max-w-3xl scroll-mt-6">
          <h2 className="font-heading text-2xl font-bold">Nivel e insignias</h2>
          <p className="text-muted-foreground mt-1">
            Sumás puntos jugando, sumándote a partidos de otros y publicando partidos con cupos
            libres. Faltar a un turno resta.
          </p>
          <div className="mt-5 space-y-5">
            <TarjetaNivel puntos={puntosDelNivel} racha={estadisticas.rachaSemanas} />
            <EscaleraDeNiveles puntos={puntosDelNivel} />
            <InsigniasDelJugador estadisticas={estadisticas} />
          </div>
        </section>
      )}
    </main>
  )
}

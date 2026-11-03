import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { PerfilForm } from '@/components/perfil-form'
import { TarjetaNivel } from '@/components/tarjeta-nivel'
import { InsigniasDelJugador } from '@/components/insignias-del-jugador'
import { homePorRol } from '@/lib/home-por-rol'
import { estadisticasDelJugador, insigniasGanadas, puntosDe } from '@/lib/gamificacion'
import { getPartidosDeJugadores } from '@/lib/partidos-de-jugadores'

// Única pantalla de perfil para jugador y dueño (el proxy deja pasar /perfil
// para cualquier rol). El admin es una cuenta de la app: no tiene perfil.
export default async function PerfilPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol === 'ADMIN') redirect('/admin')

  const esJugador = session.user.rol === 'JUGADOR'
  const [usuario, partidos] = await Promise.all([
    db.usuario.findUnique({
      where: { id: session.user.id },
      select: { nombre: true, email: true, telefono: true, dni: true, imagenUrl: true },
    }),
    // El dueño no juega: no tiene nivel ni insignias
    esJugador ? getPartidosDeJugadores([session.user.id]) : null,
  ])
  if (!usuario) redirect('/login')

  const estadisticas = partidos ? estadisticasDelJugador(partidos.get(session.user.id) ?? []) : null

  return (
    <main>
      <h1 className="font-heading text-4xl font-bold tracking-tight">Mi perfil</h1>
      <p className="text-muted-foreground mt-1">
        Cambiá tus datos y tu foto. Así te ven en TocaYJuga.
      </p>
      <div className="mt-6 max-w-3xl">
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
            <TarjetaNivel puntos={puntosDe(estadisticas)} />
            <InsigniasDelJugador ganadas={insigniasGanadas(estadisticas).map((i) => i.id)} />
          </div>
        </section>
      )}
    </main>
  )
}

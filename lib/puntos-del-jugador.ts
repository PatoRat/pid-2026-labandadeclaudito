import { estadisticasDelJugador, puntosDe } from '@/lib/gamificacion'
import { getPartidosDeJugadores } from '@/lib/partidos-de-jugadores'
import { getPenalizacionDeJugadores } from '@/lib/tickets'

// El total de puntos "real" de cada jugador: lo que suma por sus reservas
// (derivado, ver lib/gamificacion.ts) menos la penalización vigente de los
// tickets del admin (ver lib/tickets.ts). Nunca baja de 0.
// Punto único para que el nivel, el descuento y la tarjeta de nivel muestren
// siempre lo mismo. Para un solo jugador, usar puntosDeUnJugador.
export async function puntosDeJugadores(jugadorIds: string[]): Promise<Map<string, number>> {
  const [partidosPorJugador, penalizacionPorJugador] = await Promise.all([
    getPartidosDeJugadores(jugadorIds),
    getPenalizacionDeJugadores(jugadorIds),
  ])

  const porJugador = new Map<string, number>()
  for (const id of jugadorIds) {
    const partidos = partidosPorJugador.get(id) ?? []
    const penalizacion = penalizacionPorJugador.get(id) ?? 0
    const total = puntosDe(estadisticasDelJugador(partidos)) - penalizacion
    porJugador.set(id, Math.max(0, total))
  }
  return porJugador
}

export async function puntosDeUnJugador(jugadorId: string): Promise<number> {
  const porJugador = await puntosDeJugadores([jugadorId])
  return porJugador.get(jugadorId) ?? 0
}

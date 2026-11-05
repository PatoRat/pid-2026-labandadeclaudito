import { estadoDeReserva, type ReservaParaEstado } from '@/lib/estado-reserva'
import { momentoActual } from '@/lib/time'

// La gamificación no se guarda: puntos, nivel e insignias salen de las reservas
// cada vez que se leen (igual que los estados EN_CURSO/FINALIZADA). Así, si el
// dueño corrige una asistencia, los puntos se corrigen solos.

// Un partido del jugador: una reserva suya (propio) o una a la que se sumó.
// jugadores: lo de la reserva (null = completa, un número = se publicó con
// cupos libres).
export type PartidoDelJugador = ReservaParaEstado & {
  propio: boolean
  jugadores: number | null
  complejoId: string
  // El jugador ya calificó el complejo por este turno
  calificado: boolean
  // Un amigo lo etiquetó en esta reserva finalizada (no la reservó ni se sumó)
  etiquetado: boolean
}

export type EstadisticasDelJugador = {
  jugadosPropios: number
  jugadosSumado: number
  jugadosEtiquetado: number
  abiertosJugados: number
  noShows: number
  complejos: number
  calificaciones: number
}

export const PUNTOS = {
  jugado: 10,
  sumado: 15,
  etiquetado: 10,
  abierto: 5,
  calificar: 3,
  noShow: -20,
}

export function estadisticasDelJugador(
  partidos: PartidoDelJugador[],
  ahora = momentoActual(),
): EstadisticasDelJugador {
  const estadisticas = {
    jugadosPropios: 0,
    jugadosSumado: 0,
    jugadosEtiquetado: 0,
    abiertosJugados: 0,
    noShows: 0,
    complejos: 0,
    calificaciones: 0,
  }
  const complejos = new Set<string>()

  for (const partido of partidos) {
    const estado = estadoDeReserva(partido, ahora)

    // La asistencia la marca el dueño solo para el que reservó: si no fue, el
    // partido no se jugó, pero el no-show es solo suyo.
    if (estado === 'NO_SHOW') {
      if (partido.propio) estadisticas.noShows++
      continue
    }
    // Terminado y sin no-show = jugado, aunque el dueño no haya marcado nada
    if (estado !== 'ASISTIO' && estado !== 'FINALIZADA') continue

    complejos.add(partido.complejoId)

    // A un amigo lo etiquetaron: jugó el partido, pero no lo reservó ni lo
    // calificó (la calificación es del que reservó o se sumó).
    if (partido.etiquetado) {
      estadisticas.jugadosEtiquetado++
      continue
    }

    if (partido.calificado) estadisticas.calificaciones++
    if (!partido.propio) {
      estadisticas.jugadosSumado++
      continue
    }
    estadisticas.jugadosPropios++
    if (partido.jugadores !== null) estadisticas.abiertosJugados++
  }

  estadisticas.complejos = complejos.size
  return estadisticas
}

export function puntosDe(e: EstadisticasDelJugador): number {
  return (
    e.jugadosPropios * PUNTOS.jugado +
    e.jugadosSumado * PUNTOS.sumado +
    e.jugadosEtiquetado * PUNTOS.etiquetado +
    e.abiertosJugados * PUNTOS.abierto +
    e.calificaciones * PUNTOS.calificar +
    e.noShows * PUNTOS.noShow
  )
}

// Ordenados de menor a mayor: el nivel es el último cuyo "desde" se alcanzó
// descuento: % sobre el precio del turno al reservar (ver montoDelDescuento)
export const NIVELES = [
  { nombre: 'Suplente', desde: 0, descuento: 0 },
  { nombre: 'Titular', desde: 50, descuento: 5 },
  { nombre: 'Capitán', desde: 150, descuento: 10 },
  { nombre: 'Crack', desde: 300, descuento: 15 },
  { nombre: 'Leyenda', desde: 600, descuento: 20 },
]

export type Nivel = (typeof NIVELES)[number]

// El nivel actual, el siguiente (null en el último) y cuántos puntos faltan.
// Con puntos negativos (muchos no-shows) se queda en el primero.
export function nivelDe(puntos: number): {
  actual: Nivel
  siguiente: Nivel | null
  faltan: number
} {
  let i = 0
  while (i + 1 < NIVELES.length && puntos >= NIVELES[i + 1].desde) i++
  const siguiente = NIVELES[i + 1] ?? null
  return {
    actual: NIVELES[i],
    siguiente,
    faltan: siguiente ? siguiente.desde - puntos : 0,
  }
}

// El descuento por nivel lo paga la plataforma: el dueño cobra el turno entero
// y TocaYJuga le paga la diferencia. La seña no cambia: el descuento sale de lo
// que se paga en la cancha, así que nunca puede ser más que eso. Redondeado a
// centavos (la columna es Decimal(10, 2)).
export function montoDelDescuento(
  precioTurno: number,
  porcentajeDescuento: number,
  porcentajeSena: number,
): number {
  const descuento = (precioTurno * porcentajeDescuento) / 100
  const enLaCancha = (precioTurno * (100 - porcentajeSena)) / 100
  return Math.round(Math.min(descuento, enLaCancha) * 100) / 100
}

export const INSIGNIAS = [
  {
    id: 'debut',
    nombre: 'Debut',
    descripcion: 'Jugaste tu primer partido',
    ganada: (e: EstadisticasDelJugador) => e.jugadosPropios + e.jugadosSumado >= 1,
  },
  {
    id: 'palabra',
    nombre: 'Palabra de jugador',
    descripcion: 'Jugaste 10 partidos sin faltar a ninguno',
    ganada: (e: EstadisticasDelJugador) =>
      e.jugadosPropios + e.jugadosSumado >= 10 && e.noShows === 0,
  },
  {
    id: 'refuerzo',
    nombre: 'Refuerzo',
    descripcion: 'Te sumaste a 5 partidos de otros jugadores',
    ganada: (e: EstadisticasDelJugador) => e.jugadosSumado >= 5,
  },
  {
    id: 'organizador',
    nombre: 'Organizador',
    descripcion: 'Publicaste 3 partidos con cupos libres',
    ganada: (e: EstadisticasDelJugador) => e.abiertosJugados >= 3,
  },
  {
    id: 'trotamundos',
    nombre: 'Trotamundos',
    descripcion: 'Jugaste en 3 complejos distintos',
    ganada: (e: EstadisticasDelJugador) => e.complejos >= 3,
  },
  {
    id: 'critico',
    nombre: 'Crítico',
    descripcion: 'Hiciste 5 calificaciones',
    ganada: (e: EstadisticasDelJugador) => e.calificaciones >= 5,
  },
]

export function insigniasGanadas(e: EstadisticasDelJugador) {
  return INSIGNIAS.filter((insignia) => insignia.ganada(e))
}

export type FilaDelRanking = {
  id: string
  nombre: string
  puntosDelMes: number
  puntosTotales: number
}

// Ranking del mes en curso: cuenta solo los partidos de este mes, así alguien
// nuevo puede llegar arriba. Los que no sumaron este mes no aparecen. Con los
// mismos puntos, por nombre (el orden no cambia entre recargas).
// penalizacionDelMes: la penalización de los tickets que el admin creó este mes,
// por jugador. Se resta al puntaje mensual (la penalización pertenece al mes del
// ticket). Vacío = sin penalizaciones (así los tests siguen igual).
export function rankingDelMes(
  jugadores: { id: string; nombre: string }[],
  partidosPorJugador: Map<string, PartidoDelJugador[]>,
  ahora = momentoActual(),
  penalizacionDelMes: Map<string, number> = new Map(),
): FilaDelRanking[] {
  const mes = ahora.dia.slice(0, 7) // "YYYY-MM"

  const filas = jugadores.map((jugador) => {
    const partidos = partidosPorJugador.get(jugador.id) ?? []
    const delMes = partidos.filter((partido) => partido.dia.startsWith(mes))
    const penalizacion = penalizacionDelMes.get(jugador.id) ?? 0
    return {
      id: jugador.id,
      nombre: jugador.nombre,
      puntosDelMes: Math.max(0, puntosDe(estadisticasDelJugador(delMes, ahora)) - penalizacion),
      puntosTotales: puntosDe(estadisticasDelJugador(partidos, ahora)),
    }
  })

  return filas
    .filter((fila) => fila.puntosDelMes > 0)
    .sort((a, b) => b.puntosDelMes - a.puntosDelMes || a.nombre.localeCompare(b.nombre))
}

// Atajo para el caso más común: los puntos de una lista de partidos, hoy
export function puntosDeLosPartidos(partidos: PartidoDelJugador[]): number {
  return puntosDe(estadisticasDelJugador(partidos))
}

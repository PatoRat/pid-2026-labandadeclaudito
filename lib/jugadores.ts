import type { Deporte } from '@/lib/generated/prisma/client'

// Máximo de jugadores por deporte (total, ambos equipos). Con menos que esto,
// la reserva está incompleta.
export const maxJugadoresPorDeporte: Record<Deporte, number> = {
  FUTBOL_5: 10,
  FUTBOL_7: 14,
  FUTBOL_11: 22,
  TENIS: 4,
  PADEL: 4,
  BASQUET: 10,
}

// Normaliza lo que se quiere guardar: null = completa. Nunca negativo; si llega
// al máximo (o más), queda completa (null).
export function normalizarJugadores(deporte: Deporte, jugadores: number | null): number | null {
  if (jugadores === null) return null
  const max = maxJugadoresPorDeporte[deporte]
  if (jugadores >= max) return null
  if (jugadores < 1) return 1
  return jugadores
}

// Cuántos faltan para completar. 0 = completa (null o ya llena).
export function jugadoresFaltantes(deporte: Deporte, jugadores: number | null): number {
  if (jugadores === null) return 0
  const faltan = maxJugadoresPorDeporte[deporte] - jugadores
  return faltan > 0 ? faltan : 0
}

// Texto del subtexto, o null si está completa (para no renderizar nada).
export function textoJugadoresFaltantes(deporte: Deporte, jugadores: number | null): string | null {
  const faltan = jugadoresFaltantes(deporte, jugadores)
  if (faltan === 0) return null
  return faltan === 1
    ? 'Falta 1 jugador para completar'
    : `Faltan ${faltan} jugadores para completar`
}

// Cupo "cargados/máximo" (ej. "6/10") para mostrar en un turno ya reservado.
// null = completa, así que se muestra el máximo (ej. "10/10").
export function textoCupo(deporte: Deporte, jugadores: number | null): string {
  const max = maxJugadoresPorDeporte[deporte]
  return `${jugadores ?? max}/${max}`
}

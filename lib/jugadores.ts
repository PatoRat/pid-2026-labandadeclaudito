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

// Normaliza lo que se quiere guardar. null = completa (elegida explícitamente).
// Un número se acota a [1, máximo]: nunca negativo ni mayor al máximo. Se guarda
// el número real (aunque sea el máximo), para poder restar si alguien se sale.
export function normalizarJugadores(deporte: Deporte, jugadores: number | null): number | null {
  if (jugadores === null) return null
  const max = maxJugadoresPorDeporte[deporte]
  if (jugadores > max) return max
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

// Una reserva está incompleta (le falta gente, se puede sumar otro) cuando tiene
// un número por debajo del máximo. null = completa.
export function esIncompleta(deporte: Deporte, jugadores: number | null): boolean {
  return jugadoresFaltantes(deporte, jugadores) > 0
}

// Suma jugadores a una reserva, sin pasar del máximo. Devuelve el número real
// (si llega al máximo, queda en el máximo, no en null). `actual` null ya está
// completa, no se debería sumar.
export function sumarJugadores(deporte: Deporte, actual: number | null, suma: number): number {
  const max = maxJugadoresPorDeporte[deporte]
  const base = actual ?? max
  return Math.min(base + suma, max)
}

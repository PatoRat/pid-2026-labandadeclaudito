import type { Deporte } from '@/lib/generated/prisma/client'

// Capacidad sugerida por deporte (total, ambos equipos): precarga el campo al
// dar de alta una cancha. El máximo real de cada reserva es Cancha.capacidad;
// con menos que eso, la reserva está incompleta.
export const capacidadPorDeporte: Record<Deporte, number> = {
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
export function normalizarJugadores(capacidad: number, jugadores: number | null): number | null {
  if (jugadores === null) return null
  if (jugadores > capacidad) return capacidad
  if (jugadores < 1) return 1
  return jugadores
}

// Cuántos faltan para completar. 0 = completa (null o ya llena).
export function jugadoresFaltantes(capacidad: number, jugadores: number | null): number {
  if (jugadores === null) return 0
  const faltan = capacidad - jugadores
  return faltan > 0 ? faltan : 0
}

// Texto del subtexto, o null si está completa (para no renderizar nada).
export function textoJugadoresFaltantes(
  capacidad: number,
  jugadores: number | null,
): string | null {
  const faltan = jugadoresFaltantes(capacidad, jugadores)
  if (faltan === 0) return null
  return faltan === 1
    ? 'Falta 1 jugador para completar'
    : `Faltan ${faltan} jugadores para completar`
}

// Cupo "cargados/máximo" (ej. "6/10") para mostrar en un turno ya reservado.
// null = completa, así que se muestra el máximo (ej. "10/10").
export function textoCupo(capacidad: number, jugadores: number | null): string {
  return `${jugadores ?? capacidad}/${capacidad}`
}

// Una reserva está incompleta (le falta gente, se puede sumar otro) cuando tiene
// un número por debajo del máximo. null = completa.
export function esIncompleta(capacidad: number, jugadores: number | null): boolean {
  return jugadoresFaltantes(capacidad, jugadores) > 0
}

// Suma jugadores a una reserva, sin pasar del máximo. Devuelve el número real
// (si llega al máximo, queda en el máximo, no en null). `actual` null ya está
// completa, no se debería sumar.
export function sumarJugadores(capacidad: number, actual: number | null, suma: number): number {
  const base = actual ?? capacidad
  return Math.min(base + suma, capacidad)
}

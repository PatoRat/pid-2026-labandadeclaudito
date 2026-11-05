import { db } from '@/lib/db'
import { PUNTOS } from '@/lib/gamificacion'
import type { EstadoTicket } from '@/lib/generated/prisma/client'

// La penalización de un ticket no se guarda en puntos: se deriva de cuántas
// reservas invalidó el admin, igual que los puntos salen de las reservas. Así
// el cálculo es siempre una resta sobre el total derivado (ver
// lib/puntos-del-jugador.ts) y nunca un número absoluto escrito a mano.
export function penalizacionDe(ticket: { reservasInvalidas: number }): number {
  return ticket.reservasInvalidas * PUNTOS.jugado
}

// El plazo del jugador: 5 días desde que el admin crea el ticket.
export const DIAS_PARA_RESPONDER_TICKET = 5

export function venceElTicket(creadoEn: Date): Date {
  return new Date(creadoEn.getTime() + DIAS_PARA_RESPONDER_TICKET * 24 * 60 * 60 * 1000)
}

// Cuándo la penalización efectivamente resta puntos (sin cron, se evalúa al
// leer, como el estado FINALIZADA de las reservas):
// - CONFIRMADO: el admin rechazó la evidencia, la penalización queda firme.
// - vencido y no ANULADO: pasaron los 5 días sin que el admin la anule, se
//   aplica sola aunque el jugador todavía pueda apelar.
// No aplica mientras está PENDIENTE y en plazo, ni si quedó ANULADO.
export function penalizacionActiva(
  ticket: { estado: EstadoTicket; venceEn: Date },
  ahora: Date = new Date(),
): boolean {
  if (ticket.estado === 'ANULADO') return false
  if (ticket.estado === 'CONFIRMADO') return true
  return ahora > ticket.venceEn
}

// La penalización vigente de cada jugador: suma de los tickets activos. Una
// sola consulta para varios jugadores (inicio, perfil, ranking).
// Con creadosDesde solo cuenta los tickets creados a partir de esa fecha: lo usa
// el ranking mensual, porque la penalización pertenece al mes en que el admin
// creó el ticket (así la mensual se resetea cada mes y no la arrastra siempre).
export async function getPenalizacionDeJugadores(
  jugadorIds: string[],
  opciones: { ahora?: Date; creadosDesde?: Date } = {},
): Promise<Map<string, number>> {
  const ahora = opciones.ahora ?? new Date()
  const porJugador = new Map<string, number>(jugadorIds.map((id) => [id, 0]))
  if (jugadorIds.length === 0) return porJugador

  const tickets = await db.ticket.findMany({
    where: {
      jugadorId: { in: jugadorIds },
      ...(opciones.creadosDesde ? { createdAt: { gte: opciones.creadosDesde } } : {}),
    },
    select: { jugadorId: true, estado: true, venceEn: true, reservasInvalidas: true },
  })

  for (const ticket of tickets) {
    if (!penalizacionActiva(ticket, ahora)) continue
    const acumulado = porJugador.get(ticket.jugadorId) ?? 0
    porJugador.set(ticket.jugadorId, acumulado + penalizacionDe(ticket))
  }
  return porJugador
}

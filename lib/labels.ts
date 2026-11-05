import type {
  DecisionDisputa,
  Deporte,
  EstadoAprobacion,
  EstadoDisputa,
  EstadoTicket,
  Rol,
  TipoSuperficie,
} from '@/lib/generated/prisma/client'
import type { EstadoVisible } from '@/lib/estado-reserva'
import type { GrupoDeEstado } from '@/lib/admin-bookings'

export const deporteLabels: Record<Deporte, string> = {
  FUTBOL_5: 'Fútbol 5',
  FUTBOL_7: 'Fútbol 7',
  FUTBOL_11: 'Fútbol 11',
  TENIS: 'Tenis',
  PADEL: 'Pádel',
  BASQUET: 'Básquet',
}

export const superficieLabels: Record<TipoSuperficie, string> = {
  CESPED_SINTETICO: 'Césped sintético',
  CESPED_NATURAL: 'Césped natural',
  CEMENTO: 'Cemento',
  PARQUET: 'Parquet',
  POLVO_DE_LADRILLO: 'Polvo de ladrillo',
}

// Combinaciones deporte/superficie que tienen sentido en la realidad
// (ej: fútbol nunca se juega en polvo de ladrillo, eso es de tenis; parquet
// es solo de básquet, ni tenis ni pádel se juegan ahí).
export const superficiesPorDeporte: Record<Deporte, TipoSuperficie[]> = {
  FUTBOL_5: ['CESPED_SINTETICO', 'CESPED_NATURAL', 'CEMENTO'],
  FUTBOL_7: ['CESPED_SINTETICO', 'CESPED_NATURAL', 'CEMENTO'],
  FUTBOL_11: ['CESPED_SINTETICO', 'CESPED_NATURAL', 'CEMENTO'],
  TENIS: ['POLVO_DE_LADRILLO', 'CESPED_NATURAL', 'CEMENTO'],
  PADEL: ['CESPED_SINTETICO', 'CEMENTO'],
  BASQUET: ['PARQUET', 'CEMENTO'],
}

export const rolLabels: Record<Rol, string> = {
  JUGADOR: 'Jugador',
  DUENIO: 'Dueño',
  ADMIN: 'Administrador',
}

export const estadoVisibleLabels: Record<EstadoVisible, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizada',
  ASISTIO: 'Asistió',
  NO_SHOW: 'Ausente',
  CANCELADA: 'Cancelada',
}

export const estadoDisputaLabels: Record<EstadoDisputa, string> = {
  ABIERTA: 'Disputa abierta',
  RESUELTA: 'Disputa resuelta',
}

// Para el pill del historial de reservas, donde el contexto ya dice que es una
// disputa: el texto largo no entraba en una celda de la tabla
export const estadoDisputaCorto: Record<EstadoDisputa, string> = {
  ABIERTA: 'Abierta',
  RESUELTA: 'Resuelta',
}

export const estadoAprobacionLabels: Record<EstadoAprobacion, string> = {
  PENDIENTE: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
}

export const decisionDisputaLabels: Record<DecisionDisputa, string> = {
  A_FAVOR_JUGADOR: 'A favor del jugador',
  A_FAVOR_DUENIO: 'A favor del complejo',
}

// Cómo quedó un ticket de penalización ya resuelto (o pendiente)
export const estadoTicketLabels: Record<EstadoTicket, string> = {
  PENDIENTE: 'Pendiente',
  ANULADO: 'Anulado',
  CONFIRMADO: 'Confirmado',
}

// El índice es el día de la semana de Date.getUTCDay(): 0 = domingo
export const nombresDeDias = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

export const nombresCortosDeDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export const nombresDeMeses = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

// Cuántos juegan por lado, para el cartel de la cancha ilustrada
export const formatoDeJuego: Record<Deporte, string> = {
  FUTBOL_5: '5 vs 5',
  FUTBOL_7: '7 vs 7',
  FUTBOL_11: '11 vs 11',
  TENIS: 'Singles o dobles',
  PADEL: '2 vs 2',
  BASQUET: '5 vs 5',
}

export function formatPrecio(precio: number | string): string {
  return `$${Number(precio).toLocaleString('es-AR')}`
}

export const mesesCortos = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

// En plural: son los títulos de las pestañas de conteo de /admin/reservas
export const grupoDeEstadoLabels: Record<GrupoDeEstado, string> = {
  PENDIENTE: 'Pendientes',
  CONFIRMADA: 'Confirmadas',
  EN_CURSO: 'En curso',
  FINALIZADA: 'Finalizadas',
  NO_SHOW: 'Ausentes',
  CANCELADA: 'Canceladas',
}

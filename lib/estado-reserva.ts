import type { EstadoReserva } from '@/lib/generated/prisma/client'

// Los estados que ve el usuario. Los de la base (PENDIENTE, CONFIRMADA,
// CANCELADA) son decisiones de una persona; el resto sale del reloj y de la
// asistencia que marcó el dueño, y no se guardan nunca.
export type EstadoVisible = EstadoReserva | 'EN_CURSO' | 'FINALIZADA' | 'ASISTIO' | 'NO_SHOW'

export type ReservaParaEstado = {
  estado: EstadoReserva
  asistio: boolean | null
  dia: string
  horaInicio: string
  horaFin: string
}

export function estadoDeReserva(
  reserva: ReservaParaEstado,
  ahora: { dia: string; hora: string },
): EstadoVisible {
  const { estado, asistio, dia, horaInicio, horaFin } = reserva

  if (estado === 'CANCELADA') return 'CANCELADA'
  if (estado === 'PENDIENTE') return 'PENDIENTE'

  // Solo una CONFIRMADA depende del reloj.
  if (ahora.dia < dia) return 'CONFIRMADA'
  if (ahora.dia > dia) return estadoDeUnTurnoTerminado(asistio)

  // Un turno que termina a medianoche tiene fin "00:00", que como texto es
  // menor que cualquier hora: se lo compara como "24:00" (igual que en
  // horariosSeSuperponen).
  const finComparable = horaFin === '00:00' ? '24:00' : horaFin

  if (ahora.hora < horaInicio) return 'CONFIRMADA'
  if (ahora.hora < finComparable) return 'EN_CURSO'
  return estadoDeUnTurnoTerminado(asistio)
}

// Se califica un turno que ya se jugó: confirmado, terminado y sin no-show.
// Si el dueño todavía no marcó la asistencia (FINALIZADA) también vale: no
// marcar no puede dejar al jugador sin opinar. La usan el endpoint y el
// historial (para mostrar o no el botón "Calificar").
export function sePuedeCalificar(
  reserva: ReservaParaEstado,
  ahora: { dia: string; hora: string },
): boolean {
  const estado = estadoDeReserva(reserva, ahora)
  return estado === 'FINALIZADA' || estado === 'ASISTIO'
}

export const MINUTOS_PARA_PAGAR_SENA = 15

// Armado con la constante: si cambia el plazo, el mensaje lo acompaña
export const MENSAJE_SENA_VENCIDA = `Se venció el plazo de ${MINUTOS_PARA_PAGAR_SENA} minutos para pagar la seña. Reservá el turno de nuevo.`

// Una reserva pendiente tiene MINUTOS_PARA_PAGAR_SENA minutos desde que se
// pidió para pagar la seña. Pasado ese plazo deja de ocupar el turno y no se
// muestra más.
export function venceLaSena(creadaEn: Date): Date {
  return new Date(creadaEn.getTime() + MINUTOS_PARA_PAGAR_SENA * 60 * 1000)
}

export function senaVencida(creadaEn: Date, ahora: Date = new Date()): boolean {
  return ahora > venceLaSena(creadaEn)
}

// Lo que falta para que venza la seña, como "MM:SS" para la cuenta regresiva.
// Redondea para arriba (con 14,2 segundos muestra 00:15) y nunca es negativo.
export function formatearTiempoRestante(msRestantes: number): string {
  const segundos = Math.max(Math.ceil(msRestantes / 1000), 0)
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

// Terminado el turno, lo que manda es si el dueño marcó la asistencia.
function estadoDeUnTurnoTerminado(asistio: boolean | null): EstadoVisible {
  if (asistio === true) return 'ASISTIO'
  if (asistio === false) return 'NO_SHOW'
  return 'FINALIZADA'
}

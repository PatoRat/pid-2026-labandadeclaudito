import { describe, expect, test } from 'vitest'
import {
  estadoDeReserva,
  formatearTiempoRestante,
  sePuedeCalificar,
  senaVencida,
} from './estado-reserva'

describe('senaVencida', () => {
  const creadaEn = new Date('2026-09-29T15:00:00Z')

  function minutosDespues(minutos: number) {
    return new Date(creadaEn.getTime() + minutos * 60 * 1000)
  }

  test('dentro de los 15 minutos todavía se puede pagar', () => {
    expect(senaVencida(creadaEn, minutosDespues(14))).toBe(false)
    expect(senaVencida(creadaEn, minutosDespues(15))).toBe(false)
  })

  test('pasados los 15 minutos, la seña venció', () => {
    expect(senaVencida(creadaEn, minutosDespues(16))).toBe(true)
  })
})

// Todas las reservas de los tests son el 2026-09-29 de 20:00 a 21:00, salvo
// que el test diga otra cosa.
const dia = '2026-09-29'

function estadoALas(hora: string, diaDeAhora = dia) {
  return estadoDeReserva(
    { estado: 'CONFIRMADA', asistio: null, dia, horaInicio: '20:00', horaFin: '21:00' },
    { dia: diaDeAhora, hora },
  )
}

describe('estadoDeReserva', () => {
  test('una confirmada de otro día no depende de la hora', () => {
    expect(estadoALas('23:00', '2026-09-28')).toBe('CONFIRMADA')
    expect(estadoALas('08:00', '2026-09-30')).toBe('FINALIZADA')
  })

  test('una confirmada de hoy pasa por confirmada, en curso y finalizada', () => {
    expect(estadoALas('19:59')).toBe('CONFIRMADA')
    expect(estadoALas('20:00')).toBe('EN_CURSO')
    expect(estadoALas('20:30')).toBe('EN_CURSO')
    expect(estadoALas('21:00')).toBe('FINALIZADA')
  })

  test('un turno que termina a medianoche sigue en curso a las 23:30', () => {
    expect(
      estadoDeReserva(
        { estado: 'CONFIRMADA', asistio: null, dia, horaInicio: '23:00', horaFin: '00:00' },
        { dia, hora: '23:30' },
      ),
    ).toBe('EN_CURSO')
  })

  test('un turno de media hora transiciona igual que uno de una hora', () => {
    const turnoCorto = (hora: string) =>
      estadoDeReserva(
        { estado: 'CONFIRMADA', asistio: null, dia, horaInicio: '20:00', horaFin: '20:30' },
        { dia, hora },
      )

    expect(turnoCorto('20:00')).toBe('EN_CURSO')
    expect(turnoCorto('20:29')).toBe('EN_CURSO')
    expect(turnoCorto('20:30')).toBe('FINALIZADA')
  })

  test('el reloj no pisa los estados que decidió una persona', () => {
    expect(
      estadoDeReserva(
        { estado: 'CANCELADA', asistio: null, dia, horaInicio: '20:00', horaFin: '21:00' },
        { dia, hora: '20:30' },
      ),
    ).toBe('CANCELADA')
  })

  test('una pendiente con el turno terminado sigue pendiente', () => {
    expect(
      estadoDeReserva(
        { estado: 'PENDIENTE', asistio: null, dia, horaInicio: '20:00', horaFin: '21:00' },
        { dia, hora: '22:00' },
      ),
    ).toBe('PENDIENTE')
  })
})

describe('estadoDeReserva con la asistencia marcada', () => {
  function terminadaCon(asistio: boolean | null) {
    return estadoDeReserva(
      { estado: 'CONFIRMADA', asistio, dia, horaInicio: '20:00', horaFin: '21:00' },
      { dia, hora: '22:00' },
    )
  }

  test('terminado el turno, manda lo que marcó el dueño', () => {
    expect(terminadaCon(null)).toBe('FINALIZADA')
    expect(terminadaCon(true)).toBe('ASISTIO')
    expect(terminadaCon(false)).toBe('NO_SHOW')
  })

  test('la marca no adelanta el estado: primero tiene que terminar el turno', () => {
    const enCurso = estadoDeReserva(
      { estado: 'CONFIRMADA', asistio: false, dia, horaInicio: '20:00', horaFin: '21:00' },
      { dia, hora: '20:30' },
    )
    expect(enCurso).toBe('EN_CURSO')
  })

  test('una cancelada marcada como asistida sigue cancelada', () => {
    const cancelada = estadoDeReserva(
      { estado: 'CANCELADA', asistio: true, dia, horaInicio: '20:00', horaFin: '21:00' },
      { dia, hora: '22:00' },
    )
    expect(cancelada).toBe('CANCELADA')
  })
})

describe('formatearTiempoRestante', () => {
  test('los 15 minutos enteros', () => {
    expect(formatearTiempoRestante(15 * 60 * 1000)).toBe('15:00')
  })

  test('minutos y segundos con cero adelante', () => {
    expect(formatearTiempoRestante((4 * 60 + 7) * 1000)).toBe('04:07')
  })

  test('un pedazo de segundo cuenta como un segundo entero', () => {
    expect(formatearTiempoRestante(14_200)).toBe('00:15')
  })

  test('vencida: nunca muestra tiempo negativo', () => {
    expect(formatearTiempoRestante(0)).toBe('00:00')
    expect(formatearTiempoRestante(-5000)).toBe('00:00')
  })
})

describe('sePuedeCalificar', () => {
  const ahoraDespues = { dia: '2026-09-30', hora: '10:00' }

  function reserva(estado: 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA', asistio: boolean | null) {
    return { estado, asistio, dia, horaInicio: '20:00', horaFin: '21:00' }
  }

  test('una confirmada que ya terminó se puede calificar', () => {
    expect(sePuedeCalificar(reserva('CONFIRMADA', null), ahoraDespues)).toBe(true)
    expect(sePuedeCalificar(reserva('CONFIRMADA', true), ahoraDespues)).toBe(true)
  })

  test('no antes de que termine el turno', () => {
    expect(sePuedeCalificar(reserva('CONFIRMADA', null), { dia, hora: '19:00' })).toBe(false)
    expect(sePuedeCalificar(reserva('CONFIRMADA', null), { dia, hora: '20:30' })).toBe(false)
    expect(sePuedeCalificar(reserva('CONFIRMADA', null), { dia, hora: '21:00' })).toBe(true)
  })

  test('un no-show no califica', () => {
    expect(sePuedeCalificar(reserva('CONFIRMADA', false), ahoraDespues)).toBe(false)
  })

  test('ni una cancelada ni una que nunca pagó la seña', () => {
    expect(sePuedeCalificar(reserva('CANCELADA', null), ahoraDespues)).toBe(false)
    expect(sePuedeCalificar(reserva('PENDIENTE', null), ahoraDespues)).toBe(false)
  })
})

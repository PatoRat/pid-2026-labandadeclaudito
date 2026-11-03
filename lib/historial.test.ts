import { describe, expect, test } from 'vitest'
import { montoDelHistorial } from './historial'

const pago = { monto: '6000', porcentaje: 30, devuelto: false }

describe('montoDelHistorial', () => {
  test('por jugar: muestra lo que falta pagar y la seña como detalle', () => {
    const r = montoDelHistorial(
      { estado: 'CONFIRMADA', asistio: null, precioTurno: '20000', descuento: '0', pago },
      false,
      'JUGADOR',
    )
    expect(r?.etiqueta).toBe('Pagás en el complejo')
    expect(r?.monto).toBe('$14.000')
    expect(r?.detalle).toBe('Seña pagada $6.000 de $20.000')
  })

  test('por jugar sin seña: falta pagar todo', () => {
    const r = montoDelHistorial(
      { estado: 'CONFIRMADA', asistio: null, precioTurno: '20000', descuento: '0', pago: null },
      false,
      'DUENIO',
    )
    expect(r?.etiqueta).toBe('A cobrar en el complejo')
    expect(r?.monto).toBe('$20.000')
    expect(r?.detalle).toBeUndefined()
  })

  test('ya jugada: muestra el total del turno', () => {
    const r = montoDelHistorial(
      { estado: 'CONFIRMADA', asistio: null, precioTurno: '20000', descuento: '0', pago },
      true,
      'JUGADOR',
    )
    expect(r?.monto).toBe('$20.000')
  })

  test('cancelada: muestra solo qué pasó con la seña', () => {
    const noDevuelta = montoDelHistorial(
      { estado: 'CANCELADA', asistio: null, precioTurno: '20000', descuento: '0', pago },
      false,
      'JUGADOR',
    )
    expect(noDevuelta).toMatchObject({
      etiqueta: 'Seña no devuelta',
      monto: '$6.000',
      tono: 'peligro',
    })

    const devuelta = montoDelHistorial(
      {
        estado: 'CANCELADA',
        asistio: null,
        precioTurno: '20000',
        descuento: '0',
        pago: { ...pago, devuelto: true },
      },
      false,
      'JUGADOR',
    )
    expect(devuelta).toMatchObject({ etiqueta: 'Seña devuelta', tono: 'exito' })

    expect(
      montoDelHistorial(
        { estado: 'CANCELADA', asistio: null, precioTurno: '20000', descuento: '0', pago: null },
        false,
        'JUGADOR',
      ),
    ).toBeNull()
  })

  test('no se presentó: la seña es lo único que se cobró, no el turno entero', () => {
    const paraElJugador = montoDelHistorial(
      { estado: 'CONFIRMADA', asistio: false, precioTurno: '20000', descuento: '0', pago },
      true,
      'JUGADOR',
    )
    expect(paraElJugador).toMatchObject({
      etiqueta: 'Seña perdida',
      monto: '$6.000',
      tono: 'peligro',
    })

    const paraElDuenio = montoDelHistorial(
      { estado: 'CONFIRMADA', asistio: false, precioTurno: '20000', descuento: '0', pago },
      true,
      'DUENIO',
    )
    expect(paraElDuenio?.etiqueta).toBe('Seña retenida')

    expect(
      montoDelHistorial(
        { estado: 'CONFIRMADA', asistio: false, precioTurno: '20000', descuento: '0', pago: null },
        true,
        'DUENIO',
      ),
    ).toBeNull()
  })

  test('asistió: muestra el total del turno como cualquier jugada', () => {
    const r = montoDelHistorial(
      { estado: 'CONFIRMADA', asistio: true, precioTurno: '20000', descuento: '0', pago },
      true,
      'DUENIO',
    )
    expect(r?.etiqueta).toBe('Total cobrado')
    expect(r?.monto).toBe('$20.000')
  })

  test('con descuento: el jugador paga menos y el dueño cobra el turno entero', () => {
    const reserva = {
      estado: 'CONFIRMADA' as const,
      asistio: null,
      precioTurno: '20000',
      descuento: '2000',
      pago,
    }

    const porJugarJugador = montoDelHistorial(reserva, false, 'JUGADOR')
    expect(porJugarJugador?.monto).toBe('$12.000')
    expect(porJugarJugador?.detalle).toBe(
      'Seña pagada $6.000 de $20.000 · descuento por nivel $2.000',
    )

    const porJugarDuenio = montoDelHistorial(reserva, false, 'DUENIO')
    expect(porJugarDuenio?.monto).toBe('$12.000')
    expect(porJugarDuenio?.detalle).toBe('Seña cobrada $6.000 de $20.000 · TocaYJuga paga $2.000')

    expect(montoDelHistorial(reserva, true, 'JUGADOR')?.monto).toBe('$18.000')
    expect(montoDelHistorial(reserva, true, 'DUENIO')?.monto).toBe('$20.000')
  })
})

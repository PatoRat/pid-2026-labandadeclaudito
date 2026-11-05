import { describe, expect, test } from 'vitest'
import {
  estadisticasDelJugador,
  INSIGNIAS,
  insigniasGanadas,
  montoDelDescuento,
  nivelDe,
  puntosDe,
  rankingDelMes,
  type PartidoDelJugador,
} from './gamificacion'

// "Ahora" fijo: todo lo del 1/11 ya terminó, lo del 10/11 todavía no se jugó
const ahora = { dia: '2026-11-05', hora: '12:00' }

function partido(cambios: Partial<PartidoDelJugador> = {}): PartidoDelJugador {
  return {
    estado: 'CONFIRMADA',
    asistio: true,
    dia: '2026-11-01',
    horaInicio: '20:00',
    horaFin: '21:00',
    propio: true,
    jugadores: null,
    complejoId: 'complejo-1',
    calificado: false,
    etiquetado: false,
    ...cambios,
  }
}

function puntos(partidos: PartidoDelJugador[]): number {
  return puntosDe(estadisticasDelJugador(partidos, ahora))
}

describe('puntosDe', () => {
  test('partido propio jugado suma 10', () => {
    expect(puntos([partido()])).toBe(10)
  })

  test('partido propio terminado sin asistencia marcada también cuenta como jugado', () => {
    expect(puntos([partido({ asistio: null })])).toBe(10)
  })

  test('sumarse al partido de otro y jugarlo suma 15', () => {
    expect(puntos([partido({ propio: false })])).toBe(15)
  })

  test('publicar un partido abierto que se jugó suma 5 más', () => {
    expect(puntos([partido({ jugadores: 6 })])).toBe(15)
  })

  test('que un amigo te etiquete en un partido jugado suma 10', () => {
    expect(puntos([partido({ propio: false, etiquetado: true })])).toBe(10)
  })

  test('una etiqueta en un turno que no se jugó no suma', () => {
    expect(puntos([partido({ etiquetado: true, estado: 'CANCELADA' })])).toBe(0)
    expect(puntos([partido({ etiquetado: true, dia: '2026-11-10' })])).toBe(0)
  })

  test('no presentarse resta 20', () => {
    expect(puntos([partido(), partido({ asistio: false })])).toBe(-10)
  })

  test('calificar el complejo de un partido jugado suma 3 más', () => {
    expect(puntos([partido({ calificado: true })])).toBe(13)
    expect(puntos([partido({ propio: false, calificado: true })])).toBe(18)
  })

  test('una calificación de un turno que no se jugó no suma', () => {
    expect(puntos([partido({ estado: 'CANCELADA', calificado: true })])).toBe(0)
    expect(puntos([partido({ asistio: false, calificado: true })])).toBe(-20)
  })

  test('canceladas, pendientes y turnos que no terminaron no suman', () => {
    expect(
      puntos([
        partido({ estado: 'CANCELADA' }),
        partido({ estado: 'PENDIENTE' }),
        partido({ dia: '2026-11-10' }),
        partido({ dia: '2026-11-05', horaInicio: '11:00', horaFin: '13:00' }),
      ]),
    ).toBe(0)
  })

  test('si el que reservó no fue, al que se sumó no le suma ni le resta', () => {
    expect(puntos([partido({ propio: false, asistio: false })])).toBe(0)
  })
})

describe('nivelDe', () => {
  test('arranca en Suplente, también con puntos negativos', () => {
    expect(nivelDe(0).actual.nombre).toBe('Suplente')
    expect(nivelDe(-30).actual.nombre).toBe('Suplente')
  })

  test('cambia justo en el borde', () => {
    expect(nivelDe(49).actual.nombre).toBe('Suplente')
    expect(nivelDe(50).actual.nombre).toBe('Titular')
  })

  test('dice cuánto falta para el siguiente', () => {
    const { siguiente, faltan } = nivelDe(130)
    expect(siguiente?.nombre).toBe('Capitán')
    expect(faltan).toBe(20)
  })

  test('en el último nivel no hay siguiente', () => {
    const { actual, siguiente, faltan } = nivelDe(900)
    expect(actual.nombre).toBe('Leyenda')
    expect(siguiente).toBeNull()
    expect(faltan).toBe(0)
  })
})

describe('insigniasGanadas', () => {
  function insignias(partidos: PartidoDelJugador[]): string[] {
    return insigniasGanadas(estadisticasDelJugador(partidos, ahora)).map((i) => i.id)
  }

  test('sin partidos jugados no hay insignias', () => {
    expect(insignias([partido({ dia: '2026-11-10' })])).toEqual([])
  })

  test('Debut con el primer partido jugado', () => {
    expect(insignias([partido()])).toEqual(['debut'])
  })

  test('Palabra de jugador: 10 jugados sin ningún no-show', () => {
    const diez = Array.from({ length: 10 }, () => partido())
    expect(insignias(diez)).toContain('palabra')
    expect(insignias([...diez, partido({ asistio: false })])).not.toContain('palabra')
  })

  test('Refuerzo: 5 partidos de otros jugados', () => {
    expect(insignias(Array.from({ length: 4 }, () => partido({ propio: false })))).not.toContain(
      'refuerzo',
    )
    expect(insignias(Array.from({ length: 5 }, () => partido({ propio: false })))).toContain(
      'refuerzo',
    )
  })

  test('Organizador: 3 partidos abiertos publicados y jugados', () => {
    expect(insignias(Array.from({ length: 3 }, () => partido({ jugadores: 4 })))).toContain(
      'organizador',
    )
  })

  test('Trotamundos: jugó en 3 complejos distintos', () => {
    const dosComplejos = [partido(), partido({ complejoId: 'complejo-2' }), partido()]
    expect(insignias(dosComplejos)).not.toContain('trotamundos')
    expect(insignias([...dosComplejos, partido({ complejoId: 'complejo-3' })])).toContain(
      'trotamundos',
    )
  })

  test('Crítico: 5 calificaciones', () => {
    const calificados = (n: number) =>
      Array.from({ length: n }, () => partido({ calificado: true }))
    expect(insignias(calificados(4))).not.toContain('critico')
    expect(insignias(calificados(5))).toContain('critico')
  })
})

describe('rankingDelMes', () => {
  const jugadores = [
    { id: 'ana', nombre: 'Ana' },
    { id: 'beto', nombre: 'Beto' },
    { id: 'caro', nombre: 'Caro' },
  ]

  test('ordena por los puntos del mes, no por los de siempre', () => {
    const partidos = new Map([
      // Ana: mucho en octubre, uno solo en noviembre
      ['ana', [partido(), partido({ dia: '2026-10-10' }), partido({ dia: '2026-10-11' })]],
      // Beto: dos en noviembre
      ['beto', [partido(), partido({ propio: false })]],
    ])
    const ranking = rankingDelMes(jugadores, partidos, ahora)
    expect(ranking.map((fila) => fila.id)).toEqual(['beto', 'ana'])
    expect(ranking[0]).toMatchObject({ puntosDelMes: 25, puntosTotales: 25 })
    expect(ranking[1]).toMatchObject({ puntosDelMes: 10, puntosTotales: 30 })
  })

  test('deja afuera a los que no sumaron puntos este mes', () => {
    const partidos = new Map([
      ['ana', [partido({ asistio: false })]],
      ['beto', [partido({ dia: '2026-10-10' })]],
    ])
    expect(rankingDelMes(jugadores, partidos, ahora)).toEqual([])
  })

  test('con los mismos puntos, ordena por nombre', () => {
    const partidos = new Map([
      ['caro', [partido()]],
      ['ana', [partido()]],
    ])
    expect(rankingDelMes(jugadores, partidos, ahora).map((fila) => fila.id)).toEqual([
      'ana',
      'caro',
    ])
  })
})

describe('montoDelDescuento', () => {
  test('es el % del nivel sobre el precio del turno', () => {
    expect(montoDelDescuento(20000, 10, 30)).toBe(2000)
  })

  test('sin descuento es 0', () => {
    expect(montoDelDescuento(20000, 0, 30)).toBe(0)
  })

  test('nunca supera lo que queda por pagar en la cancha después de la seña', () => {
    // Seña del 90%: en la cancha quedan $2.000, el 20% serían $4.000
    expect(montoDelDescuento(20000, 20, 90)).toBe(2000)
    expect(montoDelDescuento(20000, 20, 100)).toBe(0)
  })

  test('redondea a centavos', () => {
    expect(montoDelDescuento(333.33, 5, 30)).toBe(16.67)
  })
})

describe('descuento de cada nivel', () => {
  test('Suplente no tiene, Leyenda el máximo', () => {
    expect(nivelDe(0).actual.descuento).toBe(0)
    expect(nivelDe(600).actual.descuento).toBe(20)
  })
})

describe('progreso de las insignias', () => {
  function progresoDe(id: string, partidos: PartidoDelJugador[]): number {
    const insignia = INSIGNIAS.find((i) => i.id === id)
    if (!insignia) throw new Error(`no existe la insignia ${id}`)
    return insignia.progreso(estadisticasDelJugador(partidos, ahora))
  }

  test('Refuerzo cuenta los partidos de otros jugados', () => {
    const tres = Array.from({ length: 3 }, () => partido({ propio: false }))
    expect(progresoDe('refuerzo', tres)).toBe(3)
  })

  test('Palabra de jugador vuelve a cero con un no-show', () => {
    const cuatro = Array.from({ length: 4 }, () => partido())
    expect(progresoDe('palabra', cuatro)).toBe(4)
    expect(progresoDe('palabra', [...cuatro, partido({ asistio: false })])).toBe(0)
  })
})

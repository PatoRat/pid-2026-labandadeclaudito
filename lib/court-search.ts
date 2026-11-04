import { db } from '@/lib/db'
import { getCalificaciones } from '@/lib/calificaciones'
import { getAvailableSlots, precioDelTurno } from '@/lib/availability'
import { complejoVisible } from '@/lib/complejos'
import { deporteLabels, formatPrecio, superficieLabels } from '@/lib/labels'
import { formatearDia, generateSlots } from '@/lib/time'
import type { Cancha, PrecioEspecial } from '@/lib/generated/prisma/client'
import type { SearchCourtsFilters } from '@/lib/validations/court-search'

// Qué canchas cumplen los filtros que se pueden resolver en la DB. Lo usan la
// búsqueda y el detalle del complejo, para que en los dos lados se vean las
// mismas canchas. Los filtros en undefined no filtran nada.
// El precio no se filtra acá: un turno puede tener un precio especial distinto
// del precio base, así que se mira turno por turno en courtsThatMatch.
function courtFilter(filtros: SearchCourtsFilters) {
  return {
    activo: true,
    deporte: filtros.deporte,
    tipoSuperficie: filtros.tipoSuperficie,
  }
}

type CanchaConPrecios = Cancha & { preciosEspeciales: PrecioEspecial[] }

// Sin fecha: todos los precios que puede tener un turno de la cancha en
// cualquier día de la semana (el base o el especial que le toque).
export function preciosDeLaSemana(cancha: CanchaConPrecios): number[] {
  const turnos = generateSlots(cancha.horaApertura, cancha.horaCierre, cancha.duracionTurnoMin)
  const precios: number[] = []

  for (let diaSemana = 0; diaSemana < 7; diaSemana++) {
    for (const turno of turnos) {
      const precio = precioDelTurno(
        cancha.precioBase,
        cancha.preciosEspeciales,
        diaSemana,
        turno.horaInicio,
      )
      precios.push(Number(precio))
    }
  }
  return precios
}

type SlotConPrecio = { horaInicio: string; disponible: boolean; precio: number }

// De los turnos de una cancha en un día, los que sirven para el jugador: libres,
// que empiecen dentro de la ventana [horaDesde, horaHasta) y con el precio en
// rango. Si la lista que devuelve está vacía, la cancha no cumple el filtro.
export function matchingSlots(
  slots: SlotConPrecio[],
  filtros: SearchCourtsFilters,
): SlotConPrecio[] {
  const turnosQueCumplen: SlotConPrecio[] = []

  for (const slot of slots) {
    if (!slot.disponible) continue
    if (filtros.horaDesde !== undefined && slot.horaInicio < filtros.horaDesde) continue
    if (filtros.horaHasta !== undefined && slot.horaInicio >= filtros.horaHasta) continue
    if (filtros.precioMin !== undefined && slot.precio < filtros.precioMin) continue
    if (filtros.precioMax !== undefined && slot.precio > filtros.precioMax) continue

    turnosQueCumplen.push(slot)
  }

  return turnosQueCumplen
}

// Con fecha: true si la cancha no tiene turnos para el jugador porque todos los
// de la franja buscada están bloqueados por el dueño (no porque estén
// reservados o ya hayan pasado). Esas canchas se muestran en gris.
export function bloqueadaEnLaFranja(
  slots: { horaInicio: string; bloqueado: boolean }[],
  filtros: SearchCourtsFilters,
): boolean {
  let turnosEnLaFranja = 0
  for (const slot of slots) {
    if (filtros.horaDesde !== undefined && slot.horaInicio < filtros.horaDesde) continue
    if (filtros.horaHasta !== undefined && slot.horaInicio >= filtros.horaHasta) continue

    turnosEnLaFranja++
    if (!slot.bloqueado) return false
  }
  return turnosEnLaFranja > 0
}

// Las zonas que el jugador puede elegir: solo las de complejos que tienen
// alguna cancha activa, porque los demás nunca aparecen en los resultados.
export async function getSearchableZones() {
  const complejos = await db.complejo.findMany({
    where: { ...complejoVisible(), canchas: { some: { activo: true } } },
    distinct: ['zona'],
    select: { zona: true },
    orderBy: { zona: 'asc' },
  })

  const zonas: string[] = []
  for (const complejo of complejos) {
    zonas.push(complejo.zona)
  }
  return zonas
}

// priceFrom: lo que se muestra como "desde $X". Con fecha es el turno más barato
// que cumple los filtros ese día; sin fecha, el turno más barato de la semana
// que está en el rango de precio.
// bloqueadaTodoElDia: con fecha, la cancha no tiene ningún turno libre en la
// franja buscada porque el dueño la bloqueó (va en gris). Sin fecha, false.
export type CourtWithPrice = CanchaConPrecios & { priceFrom: number; bloqueadaTodoElDia: boolean }

// Sin fecha se miran los precios de toda la semana. Con fecha se consulta la
// disponibilidad real de cada cancha (reservas, bloqueos y turnos que ya
// pasaron) y se dejan solo las que tienen algún turno que cumple ventana y
// precio. Las canchas se consultan en paralelo porque cada una son varias
// consultas a la DB.
// jugadorId (opcional): los turnos que se cruzan con otra reserva del
// jugador no cuentan como libres (no puede estar en dos canchas a la vez).
async function courtsThatMatch(
  canchas: CanchaConPrecios[],
  filtros: SearchCourtsFilters,
  jugadorId?: string,
): Promise<CourtWithPrice[]> {
  const fecha = filtros.fecha
  if (fecha === undefined) {
    const resultado: CourtWithPrice[] = []
    for (const cancha of canchas) {
      const enRango = preciosDeLaSemana(cancha).filter(
        (precio) =>
          (filtros.precioMin === undefined || precio >= filtros.precioMin) &&
          (filtros.precioMax === undefined || precio <= filtros.precioMax),
      )
      if (enRango.length > 0) {
        resultado.push({ ...cancha, priceFrom: Math.min(...enRango), bloqueadaTodoElDia: false })
      }
    }
    return resultado
  }

  const canchasConTurnos = await Promise.all(
    canchas.map(async (cancha) => {
      const disponibilidad = await getAvailableSlots(cancha.id, new Date(fecha), jugadorId)
      if (disponibilidad === null) return null

      const slots = disponibilidad.slots.map((slot) => ({
        horaInicio: slot.horaInicio,
        disponible: slot.disponible,
        bloqueado: slot.bloqueado,
        precio: Number(slot.precio),
      }))
      const turnos = matchingSlots(slots, filtros)
      if (turnos.length === 0) {
        // Sin turnos porque está bloqueada: se muestra igual, en gris, para que
        // el jugador sepa que existe y que ese día no se puede
        if (!bloqueadaEnLaFranja(slots, filtros)) return null
        let precioMasBajo = slots[0].precio
        for (const slot of slots) {
          if (slot.precio < precioMasBajo) {
            precioMasBajo = slot.precio
          }
        }
        return { ...cancha, priceFrom: precioMasBajo, bloqueadaTodoElDia: true }
      }

      let precioMasBajo = turnos[0].precio
      for (const turno of turnos) {
        if (turno.precio < precioMasBajo) {
          precioMasBajo = turno.precio
        }
      }
      return { ...cancha, priceFrom: precioMasBajo, bloqueadaTodoElDia: false }
    }),
  )

  // Las bloqueadas van al final: primero lo que se puede reservar
  const resultado: CourtWithPrice[] = []
  for (const cancha of canchasConTurnos) {
    if (cancha !== null && !cancha.bloqueadaTodoElDia) {
      resultado.push(cancha)
    }
  }
  for (const cancha of canchasConTurnos) {
    if (cancha !== null && cancha.bloqueadaTodoElDia) {
      resultado.push(cancha)
    }
  }
  return resultado
}

export async function searchComplexes(filtros: SearchCourtsFilters, jugadorId?: string) {
  // El filtro de la DB va dos veces: en el `some` decide qué complejos pueden
  // aparecer, y en el `include` deja solo las canchas que lo cumplen. Después,
  // con fecha, courtsThatMatch descarta las que no tienen turno libre y los
  // complejos que se quedan sin canchas.
  const complejos = await db.complejo.findMany({
    where: {
      // La zona es texto libre: "CABA" y "caba" son la misma zona
      zona: filtros.zona === undefined ? undefined : { equals: filtros.zona, mode: 'insensitive' },
      ...complejoVisible(),
      canchas: { some: courtFilter(filtros) },
    },
    include: {
      imagenes: { where: { activo: true }, orderBy: { orden: 'asc' }, take: 1 },
      canchas: {
        where: courtFilter(filtros),
        orderBy: { nombre: 'asc' },
        include: { preciosEspeciales: { where: { activo: true } } },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const complejosConCanchas = await Promise.all(
    complejos.map(async (complejo) => ({
      ...complejo,
      canchas: await courtsThatMatch(complejo.canchas, filtros, jugadorId),
    })),
  )

  // Se le pega a cada complejo su promedio de estrellas y cuántas opiniones
  // tiene, para mostrarlo en la tarjeta y poder filtrar por calificación mínima.
  const ids: string[] = []
  for (const complejo of complejosConCanchas) {
    ids.push(complejo.id)
  }
  const calificaciones = await getCalificaciones(ids)
  const complejosConCalificacion = complejosConCanchas.map((complejo) => ({
    ...complejo,
    calificacion: calificaciones.get(complejo.id) ?? { promedio: 0, cantidad: 0 },
  }))

  // Filtro de calificación mínima: los complejos sin ninguna calificación no
  // pasan (no se puede saber si llegan al mínimo).
  const calificacionMin = filtros.calificacionMin
  const complejosFiltrados =
    calificacionMin === undefined
      ? complejosConCalificacion
      : complejosConCalificacion.filter(
          (complejo) =>
            complejo.calificacion.cantidad > 0 && complejo.calificacion.promedio >= calificacionMin,
        )

  // Los complejos con todas sus canchas bloqueadas ese día van al final
  const conAlgoLibre = []
  const todoBloqueado = []
  for (const complejo of complejosFiltrados) {
    if (complejo.canchas.length === 0) continue
    let todasBloqueadas = true
    for (const cancha of complejo.canchas) {
      if (!cancha.bloqueadaTodoElDia) todasBloqueadas = false
    }
    if (todasBloqueadas) {
      todoBloqueado.push(complejo)
    } else {
      conAlgoLibre.push(complejo)
    }
  }
  return [...conAlgoLibre, ...todoBloqueado]
}

// Detalle de un complejo mostrando solo las canchas que cumplen los filtros
// con los que el jugador llegó desde la búsqueda.
export async function getComplexDetail(
  id: string,
  filtros: SearchCourtsFilters,
  jugadorId?: string,
) {
  const complejo = await db.complejo.findFirst({
    where: { id, ...complejoVisible() },
    include: {
      canchas: {
        where: courtFilter(filtros),
        orderBy: { nombre: 'asc' },
        include: { preciosEspeciales: { where: { activo: true } } },
      },
      imagenes: { where: { activo: true }, orderBy: { orden: 'asc' } },
    },
  })
  if (!complejo) return null

  return { ...complejo, canchas: await courtsThatMatch(complejo.canchas, filtros, jugadorId) }
}

// filtersToQueryString vive en court-search-url.ts (sin DB) y se reexporta acá
// para no romper los imports que ya lo traen desde '@/lib/court-search'.
export { filtersToQueryString } from '@/lib/court-search-url'

// Un filtro aplicado como "chip" (ej: "Deporte: Pádel"). withoutIt son los
// filtros que quedan al quitarlo: con eso la página arma el link de la "x".
export type FilterChip = { label: string; withoutIt: SearchCourtsFilters }

export function activeFilterChips(filtros: SearchCourtsFilters): FilterChip[] {
  const chips: FilterChip[] = []

  if (filtros.zona !== undefined) {
    chips.push({ label: `Zona: ${filtros.zona}`, withoutIt: { ...filtros, zona: undefined } })
  }
  if (filtros.deporte !== undefined) {
    chips.push({
      label: `Deporte: ${deporteLabels[filtros.deporte]}`,
      withoutIt: { ...filtros, deporte: undefined },
    })
  }
  if (filtros.tipoSuperficie !== undefined) {
    chips.push({
      label: `Superficie: ${superficieLabels[filtros.tipoSuperficie]}`,
      withoutIt: { ...filtros, tipoSuperficie: undefined },
    })
  }
  if (filtros.calificacionMin !== undefined) {
    const etiqueta =
      filtros.calificacionMin === 5 ? '5 estrellas' : `${filtros.calificacionMin}+ estrellas`
    chips.push({
      label: `Calificación: ${etiqueta}`,
      withoutIt: { ...filtros, calificacionMin: undefined },
    })
  }
  if (filtros.precioMin !== undefined) {
    chips.push({
      label: `Precio mínimo: ${formatPrecio(filtros.precioMin)}`,
      withoutIt: { ...filtros, precioMin: undefined },
    })
  }
  if (filtros.precioMax !== undefined) {
    chips.push({
      label: `Precio máximo: ${formatPrecio(filtros.precioMax)}`,
      withoutIt: { ...filtros, precioMax: undefined },
    })
  }
  if (filtros.fecha !== undefined) {
    // Sin fecha el horario no significa nada, así que se va junto con ella
    chips.push({
      label: `Fecha: ${formatearDia(filtros.fecha)}`,
      withoutIt: { ...filtros, fecha: undefined, horaDesde: undefined, horaHasta: undefined },
    })
  }
  if (filtros.horaDesde !== undefined || filtros.horaHasta !== undefined) {
    let ventana = `${filtros.horaDesde} a ${filtros.horaHasta}`
    if (filtros.horaHasta === undefined) ventana = `desde ${filtros.horaDesde}`
    if (filtros.horaDesde === undefined) ventana = `hasta ${filtros.horaHasta}`

    chips.push({
      label: `Horario: ${ventana}`,
      withoutIt: { ...filtros, horaDesde: undefined, horaHasta: undefined },
    })
  }

  return chips
}

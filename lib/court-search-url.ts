import type { SearchCourtsFilters } from '@/lib/validations/court-search'

// Los filtros como texto para la URL (?deporte=PADEL&precioMax=30000), para
// pasarlos de la búsqueda al detalle y de vuelta. Vacío si no hay ninguno.
// Vive aparte de court-search.ts (que importa la DB) para poder usarse también
// desde componentes cliente sin arrastrar Prisma/pg al bundle del navegador.
export function filtersToQueryString(filtros: SearchCourtsFilters): string {
  const params = new URLSearchParams()

  if (filtros.zona !== undefined) params.set('zona', filtros.zona)
  if (filtros.deporte !== undefined) params.set('deporte', filtros.deporte)
  if (filtros.tipoSuperficie !== undefined) params.set('tipoSuperficie', filtros.tipoSuperficie)
  if (filtros.calificacionMin !== undefined)
    params.set('calificacionMin', String(filtros.calificacionMin))
  if (filtros.precioMin !== undefined) params.set('precioMin', String(filtros.precioMin))
  if (filtros.precioMax !== undefined) params.set('precioMax', String(filtros.precioMax))
  if (filtros.fecha !== undefined) params.set('fecha', filtros.fecha)
  if (filtros.horaDesde !== undefined) params.set('horaDesde', filtros.horaDesde)
  if (filtros.horaHasta !== undefined) params.set('horaHasta', filtros.horaHasta)

  const texto = params.toString()
  return texto === '' ? '' : `?${texto}`
}

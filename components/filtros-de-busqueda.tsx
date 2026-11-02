'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Calendar, Search, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { filtersToQueryString } from '@/lib/court-search-url'
import { diaDeHoy, ultimoDiaParaReservar } from '@/lib/time'
import { SportSurfaceFilter } from '@/components/sport-surface-filter'
import { TimeRangeFilter } from '@/components/time-range-filter'
import { ZonaFilter } from '@/components/zona-filter'
import type { SearchCourtsFilters } from '@/lib/validations/court-search'

// El formulario de filtros de la búsqueda. Se usa en dos lugares: en una columna
// a la izquierda de los resultados en pantallas anchas (xl), y adentro del
// sheet en celular y tablet.
// Es un form GET: al enviarlo, los filtros quedan en la URL y la página los lee.
export function FiltrosDeBusqueda({
  filtros,
  idPrefijo,
  incompletas = false,
}: {
  filtros: SearchCourtsFilters
  idPrefijo: string
  // Si está activo el modo "ver reservas incompletas", se conserva al aplicar
  // filtros (campo oculto) y al limpiar.
  incompletas?: boolean
}) {
  const router = useRouter()
  // Los filtros guardan su valor en useState/defaultValue, que solo se leen al
  // montarse: cambiar la key fuerza a montarlos de nuevo. Cambia cuando llegan
  // filtros nuevos por URL y cada vez que se toca "Limpiar filtros" (aunque la
  // URL ya estuviera limpia y no haya navegación).
  const [vecesLimpiado, setVecesLimpiado] = useState(0)

  function limpiarFiltros() {
    setVecesLimpiado(vecesLimpiado + 1)
    router.push(`/jugador/canchas${incompletas ? '?incompletas=1' : ''}`)
  }

  // Alterna entre ver complejos y ver reservas incompletas, conservando filtros
  const qs = filtersToQueryString(filtros)
  const hrefIncompletas = `/jugador/canchas${qs === '' ? '?' : `${qs}&`}incompletas=1`
  const hrefTodos = `/jugador/canchas${qs}`

  return (
    <div className="space-y-6">
      {/* Opción destacada, arriba de todo: pasar a ver las reservas que buscan
          jugadores (o volver a los complejos). Resalta sobre el resto. */}
      <Link
        href={incompletas ? hrefTodos : hrefIncompletas}
        aria-pressed={incompletas}
        className={
          incompletas
            ? 'bg-clay text-clay-foreground shadow-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-colors'
            : 'bg-clay/15 text-clay-foreground hover:bg-clay/25 shadow-soft flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-colors'
        }
      >
        <Bell className="size-4" />
        {incompletas ? 'Ver todos los complejos' : 'Ver reservas incompletas'}
      </Link>

      <form key={`${JSON.stringify(filtros)}-${vecesLimpiado}`} method="get" className="space-y-8">
        {/* El form es GET: este campo oculto mantiene el modo al aplicar filtros */}
        {incompletas && <input type="hidden" name="incompletas" value="1" />}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Ubicación</h3>
          <ZonaFilter idPrefijo={idPrefijo} zonaInicial={filtros.zona} />
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Cancha</h3>
          <SportSurfaceFilter
            idPrefijo={idPrefijo}
            deporteInicial={filtros.deporte}
            tipoSuperficieInicial={filtros.tipoSuperficie}
          />
        </section>

        <section className="space-y-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Wallet className="size-4" />
            Precio por turno
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefijo}precioMin`}>Mínimo</Label>
              <Input
                id={`${idPrefijo}precioMin`}
                name="precioMin"
                type="number"
                min={0}
                step={1}
                placeholder="Sin mínimo"
                defaultValue={filtros.precioMin ?? ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefijo}precioMax`}>Máximo</Label>
              <Input
                id={`${idPrefijo}precioMax`}
                name="precioMax"
                type="number"
                min={0}
                step={1}
                placeholder="Sin máximo"
                defaultValue={filtros.precioMax ?? ''}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <Calendar className="size-4" />
            Disponibilidad
          </h3>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefijo}fecha`} className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              Fecha
            </Label>
            <Input
              id={`${idPrefijo}fecha`}
              name="fecha"
              type="date"
              min={diaDeHoy()}
              max={ultimoDiaParaReservar()}
              defaultValue={filtros.fecha ?? ''}
            />
          </div>

          <TimeRangeFilter
            horaDesdeInicial={filtros.horaDesde}
            horaHastaInicial={filtros.horaHasta}
          />

          <p className="text-muted-foreground text-sm">
            El horario se aplica solo si elegís una fecha: se muestran las canchas con algún turno
            libre que empiece dentro de esa franja.
          </p>
        </section>

        {/* Pegados al borde de abajo de la pantalla mientras se ve el formulario:
          con todos los filtros abiertos, el panel es más alto que la pantalla
          y los botones quedarían fuera de la vista. */}
        <div className="border-border bg-card sticky bottom-0 flex justify-end gap-2 border-t py-4">
          <Button type="button" variant="ghost" className="px-3" onClick={limpiarFiltros}>
            Limpiar
          </Button>
          <Button type="submit">
            <Search className="size-4" />
            Ver resultados
          </Button>
        </div>
      </form>
    </div>
  )
}

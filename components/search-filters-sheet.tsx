'use client'

import { SlidersHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { FiltrosDeBusqueda } from '@/components/filtros-de-busqueda'
import type { SearchCourtsFilters } from '@/lib/validations/court-search'

// En celular y tablet los filtros viven en un panel que se abre encima de la
// página: al abrirlo o cerrarlo no se mueve nada de lo que hay detrás. En
// pantallas anchas (xl) están fijos al costado y este botón se oculta.
export function SearchFiltersSheet({
  filtros,
  cantidadDeFiltros,
  incompletas = false,
}: {
  filtros: SearchCourtsFilters
  cantidadDeFiltros: number
  incompletas?: boolean
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" className="xl:hidden" />}>
        <SlidersHorizontal className="size-4" />
        Filtros
        {cantidadDeFiltros > 0 && <Badge>{cantidadDeFiltros}</Badge>}
      </SheetTrigger>

      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Combiná los que quieras para encontrar tu cancha.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <FiltrosDeBusqueda filtros={filtros} idPrefijo="sheet-" incompletas={incompletas} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { CalendarPlus, Clock, Wallet } from 'lucide-react'
import type { Deporte } from '@/lib/generated/prisma/client'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { CourtSlotPicker } from '@/components/court-slot-picker'
import { DibujoDeCancha } from '@/components/dibujo-de-cancha'
import { EtiquetaDeporte } from '@/components/etiqueta-deporte'
import { formatPrecio } from '@/lib/labels'

export function CourtBookingSheet({
  courtId,
  courtName,
  deporte,
  capacidad,
  precioBase,
  duracionTurnoMin,
  fechaInicial,
  className,
  otroDia,
  puntos,
}: {
  courtId: string
  courtName: string
  deporte: Deporte
  capacidad: number
  precioBase: string
  duracionTurnoMin: number
  fechaInicial?: string
  className?: string
  // La cancha está bloqueada el día buscado: el botón invita a elegir otro
  otroDia?: boolean
  // Puntos del jugador: de ahí salen su nivel y su beneficio al reservar
  puntos: number
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button className={className} variant={otroDia ? 'outline' : 'default'}>
            <CalendarPlus className="size-3.5" />
            {otroDia ? 'Probá otro día' : 'Reservar'}
          </Button>
        }
      />
      {/* gap-0: el espaciado lo maneja cada parte. El selector ocupa el alto
          que sobra, así su pie (resumen + botón) queda abajo de todo.
          data-[side=right]: el Sheet trae w-3/4 con ese selector; para que en
          el celular ocupe todo el ancho hay que pisarlo con el mismo. */}
      <SheetContent className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        {/* Franja con el dibujo de la cancha, que se funde con el fondo */}
        <div
          aria-hidden
          className="h-28 shrink-0 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
        >
          <DibujoDeCancha deporte={deporte} />
        </div>

        <SheetHeader className="-mt-6 pt-0">
          <SheetTitle className="text-3xl font-bold tracking-tight">{courtName}</SheetTitle>
          <SheetDescription className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <EtiquetaDeporte deporte={deporte} />
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              Turnos de {duracionTurnoMin} min
            </span>
            <span className="inline-flex items-center gap-1">
              <Wallet className="size-3.5" />
              Precio base {formatPrecio(precioBase)}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col px-4">
          <CourtSlotPicker
            courtId={courtId}
            courtName={courtName}
            capacidad={capacidad}
            precioBase={precioBase}
            fechaInicial={fechaInicial}
            puntos={puntos}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

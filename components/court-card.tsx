import { Clock } from 'lucide-react'
import type { CourtWithPrice } from '@/lib/court-search'
import { deporteLabels, formatPrecio, superficieLabels } from '@/lib/labels'
import { CourtBookingSheet } from '@/components/court-booking-sheet'
import { colorPorDeporte } from '@/components/etiqueta-deporte'
import { DibujoDeCancha } from '@/components/dibujo-de-cancha'
import { AvisoBloqueo } from '@/components/aviso-bloqueo'

// Card de una cancha en el detalle del complejo. A la izquierda, una franja
// recortada en diagonal con un dibujo de la cancha según el deporte; a la
// derecha, los datos y el botón.
// bloqueo: el texto de los horarios bloqueados del día buscado, si tiene. La
// card va en gris solo si ese día no le queda ningún turno (bloqueadaTodoElDia);
// si no, se puede reservar en los otros horarios.
export function CourtCard({
  cancha,
  fechaInicial,
  bloqueo,
  puntos,
}: {
  cancha: CourtWithPrice
  fechaInicial?: string
  bloqueo?: string
  // Puntos del jugador: de ahí salen su nivel y su beneficio al reservar
  puntos: number
}) {
  return (
    <div
      className={`bg-card shadow-card relative min-h-31 overflow-hidden rounded-2xl ${cancha.bloqueadaTodoElDia ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="absolute inset-y-0 left-0 w-25 opacity-75 [clip-path:polygon(0_0,58%_0,100%_100%,0_100%)] [mask-image:linear-gradient(90deg,black_40%,rgb(0_0_0/0.3)_100%)]">
        <DibujoDeCancha deporte={cancha.deporte} />
      </div>
      {/* Línea sobre el borde del recorte, mismos puntos que el clip-path */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="text-primary/50 absolute inset-y-0 left-0 h-full w-25"
      >
        <line
          x1="58"
          y1="0"
          x2="100"
          y2="100"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Los datos a la izquierda y, a la derecha, el precio pegado al botón.
          Si no entran en una línea (pantallas chicas), precio y botón bajan
          juntos: el precio queda a la izquierda y el botón a la derecha. En
          celular tampoco entran los dos juntos: el botón baja abajo del precio. */}
      <div className="relative ml-28 flex min-h-31 flex-wrap items-center gap-x-5 gap-y-3 py-4 pr-5">
        <div className="min-w-0 flex-[999_1_12rem]">
          <p
            className={`truncate text-[11px] font-bold tracking-wider uppercase ${colorPorDeporte[cancha.deporte]}`}
          >
            {deporteLabels[cancha.deporte]} · {superficieLabels[cancha.tipoSuperficie]}
          </p>
          <h3 className="font-heading truncate text-xl font-bold">{cancha.nombre}</h3>
          <p className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-sm">
            <Clock className="size-3.5 shrink-0" />
            {cancha.horaApertura} a {cancha.horaCierre} hs
          </p>
          {bloqueo && (
            <div className="mt-1.5">
              <AvisoBloqueo texto={bloqueo} />
            </div>
          )}
        </div>

        <div className="flex flex-auto flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div>
            <p className="text-muted-foreground text-xs">desde</p>
            <p className="font-heading text-primary text-2xl leading-tight font-bold">
              {formatPrecio(cancha.priceFrom)}
            </p>
            <p className="text-muted-foreground text-xs whitespace-nowrap">
              por turno de {cancha.duracionTurnoMin} min
            </p>
          </div>
          <CourtBookingSheet
            courtId={cancha.id}
            courtName={cancha.nombre}
            deporte={cancha.deporte}
            capacidad={cancha.capacidad}
            precioBase={cancha.precioBase.toString()}
            duracionTurnoMin={cancha.duracionTurnoMin}
            fechaInicial={cancha.bloqueadaTodoElDia ? undefined : fechaInicial}
            otroDia={cancha.bloqueadaTodoElDia}
            puntos={puntos}
          />
        </div>
      </div>
    </div>
  )
}

import { Clock, MapPin } from 'lucide-react'
import type { Deporte } from '@/lib/generated/prisma/client'
import { diaEnPalabras } from '@/lib/fechas'
import { temaDelDeporte } from '@/lib/dashboard'
import { deporteLabels } from '@/lib/labels'
import { DibujoDeCancha } from '@/components/dibujo-de-cancha'

// La tarjeta destacada del Inicio: el próximo turno en grande, sobre el color
// del deporte (tema-<deporte> en globals.css, el mismo del dashboard del dueño). La usan el jugador (su próximo partido) y el dueño (el próximo
// turno en sus canchas).
// etiqueta: el cartelito de arriba. children: lo que va abajo (el botón, la
// cuenta regresiva de la seña, quién reservó).
export function ProximoTurnoDestacado({
  etiqueta,
  dia,
  horaInicio,
  horaFin,
  cancha,
  deporte,
  lugar,
  nota,
  children,
}: {
  etiqueta: string
  dia: string
  horaInicio: string
  horaFin: string
  cancha: string
  deporte: Deporte
  lugar: string
  // Renglón chico extra bajo el lugar (ej: cuántos jugadores faltan)
  nota?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={`fondo-cancha ${temaDelDeporte(deporte)} text-acento-foreground shadow-card relative overflow-hidden rounded-3xl p-7 sm:p-8`}
    >
      {/* Franja con la cancha del deporte, recortada en diagonal contra el
          borde derecho. Es un detalle: va chica y semitransparente. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-31 opacity-50 [clip-path:polygon(42%_0,100%_0,100%_100%,0_100%)] [mask-image:linear-gradient(270deg,black_40%,rgb(0_0_0/0.3)_100%)] sm:block"
      >
        <DibujoDeCancha deporte={deporte} />
      </div>
      {/* Línea sobre el borde del recorte, mismos puntos que el clip-path */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="text-acento-foreground/40 absolute inset-y-0 right-0 hidden h-full w-31 sm:block"
      >
        <line
          x1="42"
          y1="0"
          x2="0"
          y2="100"
          stroke="currentColor"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="relative sm:pr-28">
        <p className="border-acento-foreground/40 inline-flex h-7 items-center rounded-full border px-3 text-sm font-semibold">
          {etiqueta}
        </p>
        <p className="font-heading mt-3.5 text-4xl font-bold tracking-tight">
          {diaEnPalabras(dia)}
        </p>
        <p className="mt-2 flex items-center gap-2 text-lg font-medium">
          <Clock className="size-4.5 shrink-0" />
          {horaInicio} a {horaFin} hs
        </p>
        <p className="mt-4 font-semibold">
          {cancha} · {deporteLabels[deporte]}
        </p>
        <p className="text-acento-foreground/90 mt-0.5 flex items-center gap-1.5 text-sm">
          <MapPin className="size-3.5 shrink-0" />
          {lugar}
        </p>
        {nota && <p className="text-acento-foreground/90 mt-0.5 text-sm">{nota}</p>}

        {children}
      </div>
    </div>
  )
}

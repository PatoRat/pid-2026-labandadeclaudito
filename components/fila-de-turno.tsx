import Link from 'next/link'
import type { Deporte } from '@/lib/generated/prisma/client'
import { diaCercano } from '@/lib/fechas'
import { mesesCortos, nombresCortosDeDias } from '@/lib/labels'
import { DibujoDeCancha } from '@/components/dibujo-de-cancha'
import { EtiquetaDeporte } from '@/components/etiqueta-deporte'

// Fila de un turno en una lista ("Próximas reservas", "Próximos turnos"): la
// cancha del deporte en diagonal, el día en grande, la hora y un renglón de
// detalle (cancha y complejo). Toda la fila es un link.
// children: lo que va a la derecha (una flecha para el jugador; quién reservó
// para el dueño).
export function FilaDeTurno({
  href,
  dia,
  hoy,
  horaInicio,
  horaFin,
  deporte,
  detalle,
  nota,
  children,
}: {
  href: string
  dia: string
  hoy: string
  horaInicio: string
  horaFin: string
  deporte: Deporte
  detalle: string
  // Renglón chico extra bajo el detalle (ej: cuántos jugadores faltan)
  nota?: React.ReactNode
  children: React.ReactNode
}) {
  // Arriba del número va "Hoy", "Mañana" o el día de la semana.
  // dia es YYYY-MM-DD: leído en UTC no se corre de día por la zona horaria
  const cercano = diaCercano(dia, hoy)
  let nombreDelDia = nombresCortosDeDias[new Date(`${dia}T00:00:00Z`).getUTCDay()]
  if (cercano === 'hoy') nombreDelDia = 'Hoy'
  if (cercano === 'mañana') nombreDelDia = 'Mañana'

  return (
    <Link
      href={href}
      className="bg-card shadow-card hover:bg-accent relative flex min-h-22 items-center gap-4 overflow-hidden rounded-2xl py-3 pr-5 pl-22 transition-colors"
    >
      {/* La cancha del deporte en diagonal, como en la card de cancha pero
          más angosta */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-20 opacity-75 [clip-path:polygon(0_0,58%_0,100%_100%,0_100%)] [mask-image:linear-gradient(90deg,black_40%,rgb(0_0_0/0.3)_100%)]"
      >
        <DibujoDeCancha deporte={deporte} />
      </div>
      {/* Línea sobre el borde del recorte, mismos puntos que el clip-path */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="text-primary/50 absolute inset-y-0 left-0 h-full w-20"
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

      {/* El día en grande: es lo primero que se busca en esta lista */}
      <div className="w-14 shrink-0 text-center">
        <p className="text-primary text-xs font-bold uppercase">{nombreDelDia}</p>
        <p className="font-heading text-3xl leading-none font-bold">{Number(dia.slice(8))}</p>
        <p className="text-muted-foreground mt-0.5 text-xs uppercase">
          {mesesCortos[Number(dia.slice(5, 7)) - 1]}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {/* En celular no entra el "hs" al lado de la hora */}
          <span className="font-semibold">
            {horaInicio} a {horaFin}
            <span className="hidden sm:inline"> hs</span>
          </span>
          <EtiquetaDeporte deporte={deporte} />
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-sm">{detalle}</p>
        {nota && <p className="text-muted-foreground truncate text-sm">{nota}</p>}
      </div>

      {children}
    </Link>
  )
}

import { Check, Lock, Trophy } from 'lucide-react'
import { NIVELES, nivelDe } from '@/lib/gamificacion'
import { cn } from '@/lib/utils'

// Los 5 niveles en fila, con el beneficio de cada uno: los que ya pasó con un
// tilde, el actual en verde oscuro y los que vienen con candado. Así el
// jugador ve qué gana si sigue jugando.
export function EscaleraDeNiveles({ puntos }: { puntos: number }) {
  const { actual } = nivelDe(puntos)
  const posicionActual = NIVELES.indexOf(actual)

  return (
    <ol className="grid gap-2.5 sm:grid-cols-5">
      {NIVELES.map((nivel, posicion) => {
        const esActual = posicion === posicionActual
        const yaPaso = posicion < posicionActual

        let Icono = Lock
        if (esActual) Icono = Trophy
        if (yaPaso) Icono = Check

        return (
          <li
            key={nivel.nombre}
            className={cn(
              'flex items-center gap-3 rounded-2xl p-3.5 sm:flex-col sm:items-start sm:gap-2',
              esActual && 'bg-sidebar text-sidebar-foreground shadow-card',
              yaPaso && 'bg-card shadow-card',
              !esActual && !yaPaso && 'bg-muted/60 text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                esActual && 'bg-highlight text-highlight-foreground',
                yaPaso && 'bg-primary text-primary-foreground',
                !esActual && !yaPaso && 'bg-muted',
              )}
            >
              <Icono className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading leading-tight font-bold">{nivel.nombre}</p>
              <p
                className={cn(
                  'text-xs',
                  esActual ? 'text-sidebar-foreground/70' : 'text-muted-foreground',
                )}
              >
                Desde {nivel.desde} pts
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold',
                esActual ? 'bg-highlight text-highlight-foreground' : 'bg-background',
              )}
            >
              {nivel.descuento > 0 ? `${nivel.descuento}% de beneficio` : 'Sin beneficio'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

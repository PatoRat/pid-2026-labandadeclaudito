import {
  Check,
  Footprints,
  Handshake,
  Map as MapIcon,
  Megaphone,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { INSIGNIAS, insigniasGanadas, type EstadisticasDelJugador } from '@/lib/gamificacion'
import { cn } from '@/lib/utils'

const iconos: Record<string, LucideIcon> = {
  debut: Footprints,
  palabra: ShieldCheck,
  refuerzo: Handshake,
  organizador: Megaphone,
  trotamundos: MapIcon,
  critico: Star,
}

// Todas las insignias: las ganadas en color; las que faltan, en gris con una
// barra de cuánto le falta ("3/5"). Ver que te falta poco empuja a seguir.
export function InsigniasDelJugador({ estadisticas }: { estadisticas: EstadisticasDelJugador }) {
  const cantidadGanadas = insigniasGanadas(estadisticas).length

  return (
    <div>
      <p className="text-muted-foreground mb-3 px-1 text-sm font-semibold">
        Ganaste {cantidadGanadas} de {INSIGNIAS.length} insignias
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {INSIGNIAS.map((insignia) => {
          const progreso = Math.min(insignia.progreso(estadisticas), insignia.meta)
          const ganada = progreso >= insignia.meta
          const Icono = iconos[insignia.id]
          return (
            <li
              key={insignia.id}
              className={cn(
                'flex items-center gap-3.5 rounded-2xl p-4',
                ganada ? 'bg-card shadow-card' : 'bg-muted/60',
              )}
            >
              <span
                className={cn(
                  'relative flex size-12 shrink-0 items-center justify-center rounded-full',
                  ganada
                    ? 'bg-highlight text-highlight-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <Icono className="size-5" />
                {ganada && (
                  <span className="bg-primary text-primary-foreground ring-card absolute -right-0.5 -bottom-0.5 flex size-5 items-center justify-center rounded-full ring-2">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('font-semibold', !ganada && 'text-muted-foreground')}>
                  {insignia.nombre}
                  <span className="sr-only">{ganada ? ' (ganada)' : ' (todavía no)'}</span>
                </p>
                <p className="text-muted-foreground text-sm">{insignia.descripcion}</p>
                {!ganada && (
                  <div className="mt-2 flex items-center gap-2.5">
                    <div
                      className="bg-background h-1.5 flex-1 overflow-hidden rounded-full"
                      role="progressbar"
                      aria-label={`Progreso de ${insignia.nombre}`}
                      aria-valuemin={0}
                      aria-valuemax={insignia.meta}
                      aria-valuenow={progreso}
                    >
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(progreso / insignia.meta) * 100}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                      {progreso}/{insignia.meta}
                    </span>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

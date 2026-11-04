import {
  Footprints,
  Handshake,
  Map as MapIcon,
  Megaphone,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { INSIGNIAS } from '@/lib/gamificacion'
import { cn } from '@/lib/utils'

const iconos: Record<string, LucideIcon> = {
  debut: Footprints,
  palabra: ShieldCheck,
  refuerzo: Handshake,
  organizador: Megaphone,
  trotamundos: MapIcon,
  critico: Star,
}

// Todas las insignias: las ganadas en color, las que faltan en gris con cómo
// se consiguen.
export function InsigniasDelJugador({ ganadas }: { ganadas: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {INSIGNIAS.map((insignia) => {
        const ganada = ganadas.includes(insignia.id)
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
                'flex size-11 shrink-0 items-center justify-center rounded-full',
                ganada
                  ? 'bg-highlight text-highlight-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Icono className="size-5" />
            </span>
            <div className="min-w-0">
              <p className={cn('font-semibold', !ganada && 'text-muted-foreground')}>
                {insignia.nombre}
                <span className="sr-only">{ganada ? ' (ganada)' : ' (todavía no)'}</span>
              </p>
              <p className="text-muted-foreground text-sm">{insignia.descripcion}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

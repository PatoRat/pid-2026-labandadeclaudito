import { Crown, Flame, Medal, Shield, Shirt, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Cada nivel con su ícono y su color, de más apagado a más llamativo: así de
// un vistazo se nota quién es Leyenda en un partido abierto o en una opinión.
const estiloPorNivel: Record<string, { icono: LucideIcon; clases: string }> = {
  Suplente: { icono: Shirt, clases: 'bg-muted text-muted-foreground' },
  Titular: { icono: Medal, clases: 'bg-primary/12 text-primary' },
  Capitán: { icono: Shield, clases: 'bg-clay/15 text-clay-foreground' },
  Crack: { icono: Flame, clases: 'bg-highlight text-highlight-foreground' },
  Leyenda: { icono: Crown, clases: 'bg-sidebar text-highlight' },
}

// El sello chico con el nivel de un jugador, para mostrarlo al lado de su nombre
export function SelloDeNivel({ nivel }: { nivel: string }) {
  const estilo = estiloPorNivel[nivel] ?? estiloPorNivel.Suplente
  const Icono = estilo.icono

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
        estilo.clases,
      )}
    >
      <Icono className="size-3" />
      {nivel}
    </span>
  )
}

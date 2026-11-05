import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// Una estrella con el relleno que se le pida, de 0 (vacía) a 1 (llena).
// Se dibujan dos estrellas una arriba de la otra: la gris de fondo y la
// amarilla recortada al ancho del relleno. Así un promedio de 4,5 muestra
// media estrella en vez de redondear.
// tamanio: la clase de Tailwind del tamaño (size-4, size-10...). La estrella
// amarilla la necesita para no achicarse cuando se recorta.
export function Estrella({ relleno, tamanio }: { relleno: number; tamanio: string }) {
  const porcentaje = Math.min(1, Math.max(0, relleno)) * 100

  return (
    <span className={cn('relative inline-block shrink-0', tamanio)} aria-hidden>
      <Star className={cn('fill-muted text-muted-foreground/25', tamanio)} />
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${porcentaje}%` }}
      >
        <Star className={cn('fill-highlight text-highlight-foreground/30 max-w-none', tamanio)} />
      </span>
    </span>
  )
}

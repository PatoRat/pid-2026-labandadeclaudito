import { Star } from 'lucide-react'
import type { ResumenCalificacion } from '@/lib/calificaciones'

// Muestra el promedio de estrellas de un complejo y entre cuántas opiniones sale.
// Si el complejo no tiene ninguna calificación, se avisa con texto en vez de
// mostrar cero estrellas (cero estrellas parece una mala calificación, no una
// ausencia de ellas).
export function Estrellas({ promedio, cantidad }: ResumenCalificacion) {
  if (cantidad === 0) {
    return <span className="text-muted-foreground text-xs">Sin calificaciones</span>
  }

  // Cuántas de las 5 estrellas se dibujan rellenas (se redondea el promedio).
  const estrellasLlenas = Math.round(promedio)
  const estrellas = [1, 2, 3, 4, 5]

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {estrellas.map((posicion) => (
          <Star
            key={posicion}
            className={
              posicion <= estrellasLlenas
                ? 'fill-highlight text-highlight size-3.5'
                : 'text-muted-foreground/40 size-3.5'
            }
          />
        ))}
      </div>
      <span className="text-sm font-medium">{promedio.toFixed(1)}</span>
      <span className="text-muted-foreground text-xs">({cantidad})</span>
    </div>
  )
}

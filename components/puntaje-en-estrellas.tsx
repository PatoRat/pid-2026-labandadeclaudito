import { Star } from 'lucide-react'

const POSICIONES = [1, 2, 3, 4, 5]

// Las 5 estrellas de una calificación, con las primeras `puntaje` pintadas.
export function PuntajeEnEstrellas({ puntaje }: { puntaje: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${puntaje} de 5 estrellas`}>
      {POSICIONES.map((posicion) => (
        <Star
          key={posicion}
          aria-hidden
          className={
            posicion <= puntaje
              ? 'fill-highlight text-highlight size-4'
              : 'text-muted-foreground/40 size-4'
          }
        />
      ))}
    </span>
  )
}

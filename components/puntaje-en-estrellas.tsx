import { Estrella } from '@/components/estrella'

const POSICIONES = [1, 2, 3, 4, 5]

// Las 5 estrellas de una calificación, con las primeras `puntaje` pintadas.
export function PuntajeEnEstrellas({ puntaje }: { puntaje: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${puntaje} de 5 estrellas`}>
      {POSICIONES.map((posicion) => (
        <Estrella key={posicion} relleno={posicion <= puntaje ? 1 : 0} tamanio="size-4" />
      ))}
    </span>
  )
}

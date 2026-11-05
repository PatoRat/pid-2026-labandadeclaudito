import { Estrella } from '@/components/estrella'
import type { ResumenCalificacion } from '@/lib/calificaciones'

const POSICIONES = [1, 2, 3, 4, 5]

// Muestra el promedio de estrellas de un complejo y entre cuántas opiniones sale.
// Si el complejo no tiene ninguna calificación, se avisa con texto en vez de
// mostrar cero estrellas (cero estrellas parece una mala calificación, no una
// ausencia de ellas).
export function Estrellas({ promedio, cantidad }: ResumenCalificacion) {
  if (cantidad === 0) {
    return <span className="text-muted-foreground text-xs">Sin calificaciones</span>
  }

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex items-center gap-0.5"
        aria-label={`${promedio.toFixed(1)} de 5 estrellas`}
      >
        {POSICIONES.map((posicion) => {
          // Con un promedio de 3,6: las 3 primeras llenas, la 4ª al 60% y la 5ª vacía
          const relleno = promedio - (posicion - 1)
          return <Estrella key={posicion} relleno={relleno} tamanio="size-4" />
        })}
      </span>
      <span className="font-heading text-sm font-bold">
        {promedio.toFixed(1).replace('.', ',')}
      </span>
      <span className="text-muted-foreground text-xs">
        ({cantidad} {cantidad === 1 ? 'opinión' : 'opiniones'})
      </span>
    </div>
  )
}

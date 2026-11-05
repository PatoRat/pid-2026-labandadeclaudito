'use client'

import { useState } from 'react'
import { Estrella } from '@/components/estrella'

// Filtro de calificación mínima: cinco estrellas en fila. Pasar el mouse por la
// estrella N previsualiza (más transparente) el relleno de 1 a N; al hacer clic
// queda elegido ese mínimo. Clic en la
// estrella ya elegida vuelve a "sin mínimo".
// Es un form GET, así que la estrella elegida solo cambia el estado y un input
// oculto lleva el valor a la URL (mismo patrón que time-range-filter.tsx).
// Sin estrella elegida, el oculto va vacío y no filtra.
const estrellas = [1, 2, 3, 4, 5]

export function CalificacionFilter({
  calificacionMinInicial,
}: {
  calificacionMinInicial?: number
}) {
  const [minimo, setMinimo] = useState(calificacionMinInicial ?? 0)
  // 0 = el mouse no está sobre ninguna estrella
  const [hover, setHover] = useState(0)

  function elegir(valor: number) {
    // Volver a tocar la estrella elegida saca el filtro
    setMinimo(valor === minimo ? 0 : valor)
  }

  return (
    <div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {estrellas.map((valor) => {
          // Mientras hay hover manda el hover; si no, la elegida
          const llena = hover > 0 ? valor <= hover : valor <= minimo
          return (
            <button
              key={valor}
              type="button"
              aria-label={`${valor} o más estrellas`}
              aria-pressed={valor === minimo}
              onMouseEnter={() => setHover(valor)}
              onClick={() => elegir(valor)}
            >
              {/* Más transparente mientras es solo la vista previa del mouse */}
              <span className={hover > 0 ? 'opacity-70' : undefined}>
                <Estrella relleno={llena ? 1 : 0} tamanio="size-7" />
              </span>
            </button>
          )
        })}
      </div>

      <input type="hidden" name="calificacionMin" value={minimo === 0 ? '' : String(minimo)} />
    </div>
  )
}

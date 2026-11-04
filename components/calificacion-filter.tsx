'use client'

import { useState } from 'react'

// Filtro de calificación mínima: "Cualquiera" o 1+ a 5 estrellas. Es un form
// GET, así que el botón elegido solo cambia el estado y un input oculto lleva el
// valor a la URL (mismo patrón que time-range-filter.tsx). "Cualquiera" manda
// vacío, o sea no filtra.
const opciones = [1, 2, 3, 4, 5]

export function CalificacionFilter({
  calificacionMinInicial,
}: {
  calificacionMinInicial?: number
}) {
  const [minimo, setMinimo] = useState<number | ''>(calificacionMinInicial ?? '')

  return (
    <div className="flex flex-wrap gap-2">
      <BotonOpcion activo={minimo === ''} onClick={() => setMinimo('')}>
        Cualquiera
      </BotonOpcion>
      {opciones.map((valor) => (
        <BotonOpcion key={valor} activo={minimo === valor} onClick={() => setMinimo(valor)}>
          {valor === 5 ? '5' : `${valor}+`}
        </BotonOpcion>
      ))}

      <input type="hidden" name="calificacionMin" value={minimo === '' ? '' : String(minimo)} />
    </div>
  )
}

function BotonOpcion({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={onClick}
      className={
        activo
          ? 'bg-primary text-primary-foreground shadow-button rounded-xl px-3.5 py-2 text-sm font-medium transition-colors'
          : 'bg-background/50 border-input hover:bg-accent shadow-soft rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors'
      }
    >
      {children}
    </button>
  )
}

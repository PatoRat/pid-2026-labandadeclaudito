import Link from 'next/link'
import { ArrowRight, Flame, Trophy } from 'lucide-react'
import { nivelDe } from '@/lib/gamificacion'

// Nivel del jugador con la barra hasta el siguiente. Va en el Inicio y en el
// perfil; conLink lleva a las insignias (en el perfil ya están debajo).
// racha: semanas seguidas jugando (0 = no tiene racha y no se muestra).
export function TarjetaNivel({
  puntos,
  racha = 0,
  conLink = false,
}: {
  puntos: number
  racha?: number
  conLink?: boolean
}) {
  const { actual, siguiente, faltan } = nivelDe(puntos)

  // Cuánto del tramo actual ya recorrió. Con puntos negativos queda en 0.
  const progreso = siguiente
    ? Math.max(0, (puntos - actual.desde) / (siguiente.desde - actual.desde))
    : 1

  return (
    <div className="bg-card shadow-card rounded-3xl p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm font-semibold">Tu nivel</p>
        <span className="text-muted-foreground text-sm font-semibold">{puntos} pts</span>
      </div>
      <p className="font-heading mt-1.5 flex items-center gap-2.5 text-3xl font-extrabold tracking-tight">
        <Trophy className="text-primary size-7 shrink-0" />
        {actual.nombre}
      </p>

      <div
        className="bg-muted mt-4 h-2.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={siguiente ? `Progreso hacia ${siguiente.nombre}` : 'Nivel máximo'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progreso * 100)}
      >
        <div className="bg-primary h-full rounded-full" style={{ width: `${progreso * 100}%` }} />
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        {siguiente
          ? `Te faltan ${faltan} puntos para ${siguiente.nombre}`
          : 'Llegaste al nivel máximo'}
      </p>

      {racha > 0 && (
        <p className="bg-clay/12 text-clay-foreground mt-4 flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold">
          <Flame className="animate-llama size-4.5 motion-reduce:animate-none shrink-0" />
          {racha === 1
            ? 'Jugaste esta semana: ¡seguí la racha la que viene!'
            : `¡${racha} semanas seguidas jugando!`}
        </p>
      )}

      {conLink && (
        <Link
          href="/perfil#insignias"
          className="text-primary mt-3 inline-flex items-center gap-1.5 text-sm font-semibold"
        >
          Ver mis insignias
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  )
}

import Link from 'next/link'
import { BellRing, Building2, ChevronRight, CircleCheck, Scale, Ticket } from 'lucide-react'

// La protagonista del panel del admin: lo que espera una decisión suya
// (disputas abiertas, complejos por aprobar y tickets que el jugador respondió).
// Si hay algo pendiente va en rojo y con la campana sacudiéndose, para que no
// se pase por alto.
export function ParaResolver({
  disputasAbiertas,
  antiguedadDeLaDisputa,
  complejosPorAprobar,
  antiguedadDelComplejo,
  ticketsPorResolver,
  antiguedadDelTicket,
}: {
  disputasAbiertas: number
  // "hoy", "ayer", "hace 4 días": cuánto espera la disputa más vieja
  antiguedadDeLaDisputa: string
  complejosPorAprobar: number
  // Lo mismo para el complejo que espera hace más tiempo
  antiguedadDelComplejo: string
  ticketsPorResolver: number
  // Lo mismo para el ticket respondido que espera hace más tiempo
  antiguedadDelTicket: string
}) {
  const total = disputasAbiertas + complejosPorAprobar + ticketsPorResolver

  if (total === 0) {
    return (
      <section className="fondo-cancha tema-todos text-acento-foreground shadow-card flex items-center gap-5 rounded-3xl p-7 sm:p-8">
        <CircleCheck className="size-11 shrink-0" />
        <div>
          <p className="font-heading text-3xl font-bold tracking-tight">Está todo al día</p>
          <p className="text-acento-foreground/90 mt-1">
            No hay disputas ni complejos esperando una decisión. Cuando llegue algo, va a aparecer
            acá.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="bg-card shadow-card grid grid-cols-1 gap-5 rounded-3xl p-7 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8">
      <div className="flex items-center gap-5">
        {/* origin-top: la campana se sacude colgada de arriba, como una de verdad */}
        <span className="bg-destructive flex size-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-md">
          <BellRing className="size-8 origin-top motion-safe:animate-campana" />
        </span>
        <div>
          <p className="text-destructive text-sm font-semibold">Para resolver</p>
          <p className="flex items-baseline gap-2.5">
            <span className="font-heading text-destructive text-6xl font-extrabold tracking-tighter">
              {total}
            </span>
            <span className="leading-snug font-semibold">
              {total === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </p>
        </div>
      </div>

      <div className="border-border flex flex-col justify-center gap-1 border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-8">
        {disputasAbiertas > 0 && (
          <Link
            href="/admin/disputas"
            className="hover:bg-destructive/5 -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors"
          >
            <span className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Scale className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Disputas abiertas</span>
              <span className="text-muted-foreground block text-sm">
                La más vieja, {antiguedadDeLaDisputa}
              </span>
            </span>
            <span className="bg-destructive inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 font-bold text-white tabular-nums">
              {disputasAbiertas}
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Link>
        )}

        {complejosPorAprobar > 0 && (
          <Link
            href="/admin/complejos"
            className="hover:bg-destructive/5 -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors"
          >
            <span className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Building2 className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Complejos por aprobar</span>
              <span className="text-muted-foreground block text-sm">
                El más viejo, {antiguedadDelComplejo}
              </span>
            </span>
            <span className="bg-destructive inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 font-bold text-white tabular-nums">
              {complejosPorAprobar}
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Link>
        )}

        {ticketsPorResolver > 0 && (
          <Link
            href="/admin/tickets"
            className="hover:bg-destructive/5 -mx-3 flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors"
          >
            <span className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Ticket className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Tickets respondidos</span>
              <span className="text-muted-foreground block text-sm">
                El más viejo, {antiguedadDelTicket}
              </span>
            </span>
            <span className="bg-destructive inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 font-bold text-white tabular-nums">
              {ticketsPorResolver}
            </span>
            <ChevronRight className="text-muted-foreground size-5 shrink-0" />
          </Link>
        )}
      </div>
    </section>
  )
}

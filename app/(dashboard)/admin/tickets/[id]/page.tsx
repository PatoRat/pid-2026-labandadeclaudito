import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { homePorRol } from '@/lib/home-por-rol'
import { estadoTicketLabels } from '@/lib/labels'
import { penalizacionActiva, penalizacionDe } from '@/lib/tickets'
import { formatearDia, momentoActual } from '@/lib/time'
import { ResolverTicketForm } from '@/components/resolver-ticket-form'

function diaYHora(fecha: Date) {
  const momento = momentoActual(fecha)
  return `${formatearDia(momento.dia)} ${momento.hora}`
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{etiqueta}</p>
      <div className="font-medium">{children}</div>
    </div>
  )
}

export default async function TicketDelAdminPage({ params }: PageProps<'/admin/tickets/[id]'>) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol !== 'ADMIN') redirect(homePorRol(session.user.rol))

  const { id } = await params

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      jugador: { select: { nombre: true, email: true } },
      evidencias: { orderBy: { orden: 'asc' } },
    },
  })
  if (!ticket) notFound()

  const penalizacion = penalizacionDe(ticket)
  const aplicada = penalizacionActiva(ticket)

  return (
    <main>
      <Link
        href="/admin/tickets"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Tickets
      </Link>

      <h1 className="font-heading mt-2 text-4xl font-bold tracking-tight">
        Penalización a {ticket.jugador.nombre}
      </h1>
      <p className="text-muted-foreground mt-1.5">
        {ticket.reservasInvalidas} {ticket.reservasInvalidas === 1 ? 'reserva' : 'reservas'} sin
        validar · −{penalizacion} puntos
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-6">
          <div className="bg-card shadow-card rounded-3xl p-6">
            <h2 className="font-heading text-xl font-bold">El ticket</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Dato etiqueta="Jugador">
                {ticket.jugador.nombre}
                <span className="text-muted-foreground block text-xs font-normal">
                  {ticket.jugador.email}
                </span>
              </Dato>
              <Dato etiqueta="Puntos antes del ticket">{ticket.puntosAnteriores}</Dato>
              <Dato etiqueta="Penalización">−{penalizacion} puntos</Dato>
              <Dato etiqueta="Vence">
                {diaYHora(ticket.venceEn)}
                <span className="text-muted-foreground block text-xs font-normal">
                  {aplicada
                    ? 'El descuento ya se está aplicando'
                    : 'Hasta ahí el jugador mantiene sus puntos'}
                </span>
              </Dato>
            </div>
            <div className="mt-4">
              <p className="text-muted-foreground text-xs">Motivo</p>
              <p className="mt-1 whitespace-pre-line">{ticket.motivo}</p>
            </div>
          </div>

          <div className="bg-card shadow-card rounded-3xl p-6">
            <h2 className="font-heading text-xl font-bold">La evidencia del jugador</h2>
            {ticket.comentarioJugador && (
              <p className="mt-2 whitespace-pre-line text-sm">{ticket.comentarioJugador}</p>
            )}
            {ticket.evidencias.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-sm">
                El jugador todavía no respondió con pruebas.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ticket.evidencias.map((evidencia, indice) => (
                  <a
                    key={evidencia.id}
                    href={evidencia.url}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-muted relative aspect-square overflow-hidden rounded-2xl"
                  >
                    <Image
                      src={evidencia.url}
                      alt={`Prueba ${indice + 1} de ${ticket.jugador.nombre}`}
                      fill
                      sizes="(min-width: 640px) 200px, 45vw"
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {ticket.estado === 'PENDIENTE' ? (
          <ResolverTicketForm ticketId={ticket.id} />
        ) : (
          <div className="bg-card shadow-card rounded-3xl p-6">
            <h2 className="font-heading text-xl font-bold">Cómo se resolvió</h2>
            <p className="font-heading text-primary mt-3 text-2xl font-bold">
              {estadoTicketLabels[ticket.estado]}
            </p>
            <p className="mt-3 whitespace-pre-line">{ticket.comentarioAdmin}</p>
            {ticket.resueltoEn && (
              <p className="text-muted-foreground mt-4 text-sm">
                Resuelto el {diaYHora(ticket.resueltoEn)}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarPlus, CircleDot, Coins, User } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { homePorRol } from '@/lib/home-por-rol'
import { iniciales } from '@/lib/iniciales'
import { estadoTicketLabels } from '@/lib/labels'
import { penalizacionDe } from '@/lib/tickets'
import { formatearDia, momentoActual } from '@/lib/time'
import { EstadoVacio } from '@/components/estado-vacio'
import { NuevoTicketDialog } from '@/components/nuevo-ticket-dialog'
import { TituloConIcono } from '@/components/titulo-con-icono'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Mismo estilo de pestañas que Disputas: la elegida en verde oscuro.
function clasePestania(elegida: boolean) {
  return elegida
    ? 'bg-sidebar text-sidebar-foreground inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold'
    : 'text-foreground/80 hover:bg-muted inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium'
}

function claseContador(elegida: boolean) {
  return elegida
    ? 'bg-highlight text-highlight-foreground inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1.5 text-xs font-bold'
    : 'bg-muted inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1.5 text-xs font-semibold'
}

export default async function TicketsDelAdminPage({ searchParams }: PageProps<'/admin/tickets'>) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol !== 'ADMIN') redirect(homePorRol(session.user.rol))

  const { filtro } = await searchParams
  const soloHistorial = filtro === 'historial'

  const [totalAbiertos, totalHistorial] = await Promise.all([
    db.ticket.count({ where: { estado: 'PENDIENTE' } }),
    db.ticket.count({ where: { estado: { not: 'PENDIENTE' } } }),
  ])

  const tickets = await db.ticket.findMany({
    where: soloHistorial ? { estado: { not: 'PENDIENTE' } } : { estado: 'PENDIENTE' },
    include: {
      jugador: { select: { nombre: true, email: true } },
      evidencias: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground mt-1.5">
            Penalizaciones de puntos por reservas que no corresponden. El jugador tiene 5 días para
            responder con evidencia.
          </p>
        </div>
        <NuevoTicketDialog />
      </div>

      {totalAbiertos + totalHistorial === 0 ? (
        <EstadoVacio
          titulo="No hay tickets"
          texto="Cuando penalices a un jugador, el ticket va a aparecer acá hasta que lo resuelvas."
        />
      ) : (
        <>
          <div className="bg-card shadow-soft inline-flex flex-wrap gap-1 rounded-2xl p-1">
            <Link href="/admin/tickets" className={clasePestania(!soloHistorial)}>
              Abiertos
              <span className={claseContador(!soloHistorial)}>{totalAbiertos}</span>
            </Link>
            <Link href="/admin/tickets?filtro=historial" className={clasePestania(soloHistorial)}>
              Historial
              <span className={claseContador(soloHistorial)}>{totalHistorial}</span>
            </Link>
          </div>

          {tickets.length === 0 ? (
            <p className="text-muted-foreground mt-6 text-sm">
              {soloHistorial ? 'Todavía no se resolvió ninguno.' : 'No hay tickets sin resolver.'}
            </p>
          ) : (
            <div className="bg-card shadow-card mt-5 overflow-hidden rounded-2xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-full pl-4">
                      <TituloConIcono icono={User}>Jugador</TituloConIcono>
                    </TableHead>
                    <TableHead>
                      <TituloConIcono icono={Coins}>Penalización</TituloConIcono>
                    </TableHead>
                    <TableHead>
                      <TituloConIcono icono={CalendarPlus}>Creado</TituloConIcono>
                    </TableHead>
                    <TableHead>
                      <TituloConIcono icono={CircleDot}>Estado</TituloConIcono>
                    </TableHead>
                    <TableHead className="pr-4 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="w-full pl-4">
                        <div className="flex items-center gap-2.5">
                          <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                            {iniciales(ticket.jugador.nombre)}
                          </div>
                          <div>
                            <p className="font-medium">{ticket.jugador.nombre}</p>
                            <p className="text-muted-foreground text-xs">{ticket.jugador.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">−{penalizacionDe(ticket)} pts</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatearDia(momentoActual(ticket.createdAt).dia)}
                      </TableCell>
                      <TableCell>
                        {ticket.estado === 'PENDIENTE' ? (
                          ticket.evidencias.length > 0 ? (
                            <span className="text-primary text-sm font-semibold">Respondido</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              Esperando respuesta
                            </span>
                          )
                        ) : (
                          <span className="text-sm">{estadoTicketLabels[ticket.estado]}</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          render={<Link href={`/admin/tickets/${ticket.id}`} />}
                        >
                          {ticket.estado === 'PENDIENTE' ? 'Resolver' : 'Ver'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </main>
  )
}

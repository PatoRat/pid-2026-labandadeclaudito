import { Clock } from 'lucide-react'
import { diaEnPalabras } from '@/lib/fechas'
import { formatPrecio } from '@/lib/labels'
import { textoCupo, textoJugadoresFaltantes } from '@/lib/jugadores'
import { diaDeReserva } from '@/lib/time'
import type { getPartidosAbiertos } from '@/lib/partidos-abiertos'
import { EtiquetaDeporte } from '@/components/etiqueta-deporte'
import { FranjaDeCancha } from '@/components/franja-de-cancha'
import { JoinBookingDialog } from '@/components/join-booking-dialog'

type PartidoAbierto = Awaited<ReturnType<typeof getPartidosAbiertos>>[number]

// Tarjeta de una reserva incompleta de otro jugador, para sumarse. Mismo look
// que la tarjeta de "Mis reservas" (franja + tarjeta clara con sombra).
export function TarjetaPartidoAbierto({ reserva }: { reserva: PartidoAbierto }) {
  const dia = diaDeReserva(reserva.fecha)
  const deporte = reserva.cancha.deporte

  return (
    <div className="bg-card shadow-card flex h-full flex-col overflow-hidden rounded-2xl">
      <FranjaDeCancha deporte={deporte} />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <EtiquetaDeporte deporte={deporte} />
          <span className="bg-highlight text-highlight-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
            {textoCupo(reserva.cancha.capacidad, reserva.jugadores)}
          </span>
        </div>

        <p className="font-heading mt-2 text-lg font-bold">{diaEnPalabras(dia)}</p>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="size-3.5 shrink-0" />
          {reserva.horaInicio} a {reserva.horaFin} hs
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Organiza {reserva.jugador.nombre.split(' ')[0]} ·{' '}
          <span className="text-foreground font-semibold">{reserva.nivelDelOrganizador}</span>
        </p>
        <p className="mt-2 text-sm font-semibold">{reserva.cancha.nombre}</p>
        <p className="text-muted-foreground truncate text-sm">
          {reserva.cancha.complejo.nombre} · {reserva.cancha.complejo.direccion}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {textoJugadoresFaltantes(reserva.cancha.capacidad, reserva.jugadores)}
        </p>

        <div className="mt-auto pt-3.5">
          <p className="text-muted-foreground text-xs">Precio del turno</p>
          <p className="font-heading text-primary text-xl leading-tight font-bold">
            {formatPrecio(reserva.precioTurno.toString())}
          </p>
          <JoinBookingDialog
            className="mt-3 w-full"
            bookingId={reserva.id}
            capacidad={reserva.cancha.capacidad}
            jugadores={reserva.jugadores}
          />
        </div>
      </div>
    </div>
  )
}

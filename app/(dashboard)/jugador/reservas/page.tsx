import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, CircleDot, Clock, LandPlot, Search, ShieldAlert, Wallet } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Prisma } from '@/lib/generated/prisma/client'
import { dondeHistorial, dondeProximas } from '@/lib/bookings'
import { sePuedeDisputar } from '@/lib/disputas'
import { formatPrecio } from '@/lib/labels'
import { textoJugadoresFaltantes } from '@/lib/jugadores'
import { montoDelHistorial } from '@/lib/historial'
import { venceLaSena } from '@/lib/estado-reserva'
import { calcularPagina } from '@/lib/paginacion'
import { diaEnPalabras } from '@/lib/fechas'
import { diaDeReserva, momentoActual, refundsDeposit, turnoYaPaso } from '@/lib/time'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { CancelBookingButton } from '@/components/cancel-booking-button'
import { CuentaRegresivaSena } from '@/components/cuenta-regresiva-sena'
import { CeldaCancha, CeldaMonto } from '@/components/celdas-reserva'
import { EtiquetaDeporte } from '@/components/etiqueta-deporte'
import { EstadoDeDisputa } from '@/components/estado-de-disputa'
import { EstadoVacio } from '@/components/estado-vacio'
import { DisputeFormDialog } from '@/components/dispute-form-dialog'
import { FranjaDeCancha } from '@/components/franja-de-cancha'
import { Button } from '@/components/ui/button'
import { FechaDelTurno } from '@/components/fecha-del-turno'
import { TituloConIcono } from '@/components/titulo-con-icono'
import { Paginacion } from '@/components/paginacion'
import {
  leerVista,
  PestaniasDeReservas,
  urlDeReservas,
  type VistaDeReservas,
} from '@/components/pestanias-reservas'
import { PayDepositButton } from '@/components/pay-deposit-button'
import { PlayersEditDialog } from '@/components/players-edit-dialog'
import { RefreshWhenDepositExpires } from '@/components/refresh-when-deposit-expires'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Próximas se muestran como tarjetas (tienen acciones: pagar, cancelar).
// Historial y canceladas, como tabla: son solo para consultar.
const TARJETAS_POR_PAGINA = 12
const FILAS_POR_PAGINA = 20

async function getReservas(
  where: Prisma.ReservaWhereInput,
  orden: 'asc' | 'desc',
  skip: number,
  take: number,
) {
  return db.reserva.findMany({
    where,
    include: { cancha: { include: { complejo: true } }, pago: true, disputa: true },
    orderBy: [{ fecha: orden }, { horaInicio: orden }],
    skip,
    take,
  })
}

type Reserva = Awaited<ReturnType<typeof getReservas>>[number]

const tonos = {
  normal: 'text-primary',
  exito: 'text-green-600',
  peligro: 'text-destructive',
}

export default async function MisReservasPage({ searchParams }: PageProps<'/jugador/reservas'>) {
  const session = await auth()
  if (!session) redirect('/login')
  const jugadorId = session.user.id

  // ?vista=historial|canceladas elige la pestaña (sin vista = próximas)
  // ?pagina=2 elige la página dentro de esa pestaña
  const { vista: vistaPedida, pagina } = await searchParams
  const vista = leerVista(vistaPedida)

  // Qué es "próxima" o "historial" lo decide la base (ver dondeProximas),
  // así cuenta y pagina sin traer todas las reservas.
  const ahora = momentoActual()
  const dondePorVista: Record<VistaDeReservas, Prisma.ReservaWhereInput> = {
    proximas: { jugadorId, ...dondeProximas(ahora) },
    historial: { jugadorId, ...dondeHistorial(ahora) },
    canceladas: { jugadorId, estado: 'CANCELADA' },
  }

  const [totalProximas, totalHistorial, totalCanceladas] = await Promise.all([
    db.reserva.count({ where: dondePorVista.proximas }),
    db.reserva.count({ where: dondePorVista.historial }),
    db.reserva.count({ where: dondePorVista.canceladas }),
  ])
  const totales = {
    proximas: totalProximas,
    historial: totalHistorial,
    canceladas: totalCanceladas,
  }

  const porPagina = vista === 'proximas' ? TARJETAS_POR_PAGINA : FILAS_POR_PAGINA
  const { paginaActual, totalPaginas, skip } = calcularPagina(pagina, totales[vista], porPagina)

  // Próximas: de la más cercana a la más lejana.
  // Historial y canceladas: de la más reciente a la más vieja.
  const reservas = await getReservas(
    dondePorVista[vista],
    vista === 'proximas' ? 'asc' : 'desc',
    skip,
    porPagina,
  )

  const paginacion = (
    <Paginacion
      paginaActual={paginaActual}
      totalPaginas={totalPaginas}
      desde={skip + 1}
      hasta={skip + reservas.length}
      total={totales[vista]}
      urlAnterior={urlDeReservas('/jugador/reservas', vista, paginaActual - 1)}
      urlSiguiente={urlDeReservas('/jugador/reservas', vista, paginaActual + 1)}
    />
  )

  const noReservoNunca = totalProximas + totalHistorial + totalCanceladas === 0

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight">Mis reservas</h1>
          <p className="text-muted-foreground mt-1.5">
            {totalProximas === 0 && 'Tus próximos turnos y todo lo que reservaste antes.'}
            {totalProximas === 1 && 'Tenés 1 turno por jugar.'}
            {totalProximas > 1 && `Tenés ${totalProximas} turnos por jugar.`}
          </p>
        </div>
        <Button render={<Link href="/jugador/canchas" />}>
          <Search className="size-4" />
          Buscar canchas
        </Button>
      </div>

      {noReservoNunca ? (
        <EstadoVacio
          titulo="Todavía no reservaste ninguna cancha"
          texto="Cuando reserves un turno, lo vas a ver acá."
        />
      ) : (
        <>
          <PestaniasDeReservas ruta="/jugador/reservas" vista={vista} totales={totales} />

          {reservas.length === 0 && (
            <p className="text-muted-foreground text-sm">
              {vista === 'proximas' && 'No tenés turnos próximos.'}
              {vista === 'historial' && 'Todavía no jugaste ningún turno.'}
              {vista === 'canceladas' && 'No tenés reservas canceladas.'}
            </p>
          )}

          {reservas.length > 0 && vista === 'proximas' && (
            <>
              {/* Tarjetas de ancho acotado: no se estiran para llenar la fila */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,19rem))] gap-5">
                {reservas.map((reserva) => (
                  <TarjetaReserva key={reserva.id} reserva={reserva} ahora={ahora} />
                ))}
              </div>
              {/* Con una sola página de tarjetas no hace falta el pie */}
              {totalPaginas > 1 && (
                <div className="bg-card shadow-card mt-4 overflow-hidden rounded-2xl">
                  {paginacion}
                </div>
              )}
            </>
          )}

          {reservas.length > 0 && vista !== 'proximas' && (
            <div className="bg-card shadow-card overflow-hidden rounded-2xl">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 pl-4">
                      <TituloConIcono icono={CalendarDays}>Turno</TituloConIcono>
                    </TableHead>
                    {/* Esta tabla tiene pocas columnas y le sobra ancho. Cancha
                        se queda con la mitad (es el texto más largo) y el resto
                        se reparte entre las demás, en vez de juntarse en un hueco */}
                    <TableHead className="w-1/2 px-3">
                      <TituloConIcono icono={LandPlot}>Cancha</TituloConIcono>
                    </TableHead>
                    <TableHead className="px-3">
                      <TituloConIcono icono={CircleDot}>Estado</TituloConIcono>
                    </TableHead>
                    {/* Sin la columna de disputa (Canceladas), el monto es la
                        última: ahí lleva el padding del borde de la tarjeta */}
                    <TableHead className={vista === 'historial' ? 'px-3' : 'px-3 pr-4'}>
                      <TituloConIcono icono={Wallet}>Monto</TituloConIcono>
                    </TableHead>
                    {vista === 'historial' && (
                      <TableHead className="px-3 pr-4 text-right">
                        <TituloConIcono icono={ShieldAlert}>Disputa</TituloConIcono>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservas.map((reserva) => (
                    <FilaReserva
                      key={reserva.id}
                      reserva={reserva}
                      ahora={ahora}
                      conDisputa={vista === 'historial'}
                    />
                  ))}
                </TableBody>
              </Table>
              {paginacion}
            </div>
          )}
        </>
      )}
    </main>
  )
}

// Una fila de la tabla de historial o canceladas. En el historial lleva la
// disputa: el botón para abrirla, o en qué está la que ya abrió.
function FilaReserva({
  reserva,
  ahora,
  conDisputa,
}: {
  reserva: Reserva
  ahora: { dia: string; hora: string }
  conDisputa: boolean
}) {
  const dia = diaDeReserva(reserva.fecha)
  const monto = montoDelHistorial(
    {
      estado: reserva.estado,
      asistio: reserva.asistio,
      precioTurno: reserva.precioTurno.toString(),
      pago: reserva.pago && { ...reserva.pago, monto: reserva.pago.monto.toString() },
    },
    turnoYaPaso(dia, reserva.horaInicio),
    'JUGADOR',
  )

  return (
    <TableRow>
      <TableCell className="px-3 pl-4">
        <FechaDelTurno dia={dia} horaInicio={reserva.horaInicio} horaFin={reserva.horaFin} />
      </TableCell>
      <TableCell className="w-1/2 px-3">
        <CeldaCancha
          nombre={reserva.cancha.nombre}
          deporte={reserva.cancha.deporte}
          complejo={reserva.cancha.complejo.nombre}
        />
      </TableCell>
      <TableCell className="px-3">
        <BookingStatusBadge
          estado={reserva.estado}
          asistio={reserva.asistio}
          dia={dia}
          horaInicio={reserva.horaInicio}
          horaFin={reserva.horaFin}
          ahoraInicial={ahora}
        />
      </TableCell>
      <TableCell className={conDisputa ? 'px-3' : 'px-3 pr-4'}>
        <CeldaMonto monto={monto} />
      </TableCell>
      {conDisputa && (
        <TableCell className="px-3 pr-4 text-right">
          {reserva.disputa ? (
            <EstadoDeDisputa disputa={reserva.disputa} vista="JUGADOR" />
          ) : (
            sePuedeDisputar(
              {
                estado: reserva.estado,
                asistio: reserva.asistio,
                dia,
                horaInicio: reserva.horaInicio,
                horaFin: reserva.horaFin,
                asistenciaMarcadaEn: reserva.asistenciaMarcadaEn,
              },
              ahora,
            ) && <DisputeFormDialog bookingId={reserva.id} />
          )}
        </TableCell>
      )}
    </TableRow>
  )
}

function TarjetaReserva({
  reserva,
  ahora,
}: {
  reserva: Reserva
  ahora: { dia: string; hora: string }
}) {
  const dia = diaDeReserva(reserva.fecha)
  const cancelada = reserva.estado === 'CANCELADA'
  const yaPaso = turnoYaPaso(dia, reserva.horaInicio)
  const monto = montoDelHistorial(
    {
      estado: reserva.estado,
      asistio: reserva.asistio,
      precioTurno: reserva.precioTurno.toString(),
      pago: reserva.pago && { ...reserva.pago, monto: reserva.pago.monto.toString() },
    },
    yaPaso,
    'JUGADOR',
  )
  // Mismo cálculo que hace el endpoint de la seña: es solo para mostrar el
  // monto en el botón, el que se cobra lo calcula el server.
  const porcentajeSena =
    reserva.cancha.porcentajeSena ?? reserva.cancha.complejo.porcentajeSenaDefault
  const montoSena = ((Number(reserva.precioTurno) * porcentajeSena) / 100).toString()

  const muestraPagar = reserva.estado === 'PENDIENTE' && !yaPaso
  const muestraCancelar = !cancelada && !yaPaso
  // Los jugadores se editan mientras la reserva sigue activa y el turno no pasó
  const puedeEditarJugadores = !cancelada && !yaPaso
  const notaJugadores = puedeEditarJugadores
    ? textoJugadoresFaltantes(reserva.cancha.deporte, reserva.jugadores)
    : null
  const venceSena = venceLaSena(reserva.createdAt).toISOString()

  // Aviso para el diálogo de cancelar: mismo cálculo que hace el endpoint.
  let avisoSena: string | null = null
  if (reserva.pago && muestraCancelar) {
    const horasAlPagar = reserva.pago.cancellationHours
    const horasActuales = reserva.cancha.complejo.cancellationHours
    const montoPagado = formatPrecio(reserva.pago.monto.toString())
    if (refundsDeposit(dia, reserva.horaInicio, horasAlPagar, horasActuales)) {
      avisoSena = `Se te devuelve la seña de ${montoPagado}.`
    } else {
      const horas = Math.min(horasAlPagar, horasActuales)
      avisoSena = `Faltan menos de ${horas} hs para el turno: la seña de ${montoPagado} no se devuelve.`
    }
  }

  return (
    <div
      className={
        cancelada
          ? 'bg-card shadow-card flex h-full flex-col overflow-hidden rounded-2xl opacity-60'
          : 'bg-card shadow-card flex h-full flex-col overflow-hidden rounded-2xl'
      }
    >
      <FranjaDeCancha deporte={reserva.cancha.deporte} />

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <BookingStatusBadge
            estado={reserva.estado}
            asistio={reserva.asistio}
            dia={dia}
            horaInicio={reserva.horaInicio}
            horaFin={reserva.horaFin}
            ahoraInicial={ahora}
          />
          <EtiquetaDeporte deporte={reserva.cancha.deporte} />
        </div>

        <p className="font-heading mt-2 text-lg font-bold">{diaEnPalabras(dia)}</p>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Clock className="size-3.5 shrink-0" />
          {reserva.horaInicio} a {reserva.horaFin} hs
        </p>
        <p className="mt-2 text-sm font-semibold">{reserva.cancha.nombre}</p>
        <p className="text-muted-foreground truncate text-sm">
          {reserva.cancha.complejo.nombre} · {reserva.cancha.complejo.direccion}
        </p>
        {notaJugadores && <p className="text-muted-foreground mt-1 text-sm">{notaJugadores}</p>}

        {/* De acá para abajo todas las tarjetas tienen lo mismo a la misma
            altura, esté o no pagada la seña: un renglón con su barra, el
            monto y los botones. */}
        <div className="mt-auto pt-3.5">
          {muestraPagar ? (
            <>
              <CuentaRegresivaSena venceEn={venceSena} />
              <RefreshWhenDepositExpires venceEn={venceSena} />
            </>
          ) : (
            // Mismo alto que la cuenta regresiva: un renglón y, donde iría la
            // barra, una línea divisoria (una barra llena parecía otro reloj)
            <div className="space-y-1.5">
              <p className="text-muted-foreground flex h-7 items-center text-sm">
                {monto?.detalle}
              </p>
              <div className="flex h-1.5 items-center">
                <div className="bg-border h-px flex-1" />
              </div>
            </div>
          )}

          {monto && (
            <div className="mt-3.5">
              <p className="text-muted-foreground text-xs">{monto.etiqueta}</p>
              <p className={`font-heading text-xl leading-tight font-bold ${tonos[monto.tono]}`}>
                {monto.monto}
              </p>
            </div>
          )}

          {(muestraPagar || muestraCancelar) && (
            <div className="mt-3 flex gap-2">
              {muestraPagar && (
                <PayDepositButton className="flex-1" bookingId={reserva.id} montoSena={montoSena} />
              )}
              {muestraCancelar && (
                <CancelBookingButton
                  className={muestraPagar ? undefined : 'flex-1'}
                  corto={muestraPagar}
                  bookingId={reserva.id}
                  avisoSena={avisoSena}
                />
              )}
            </div>
          )}

          {puedeEditarJugadores && (
            <PlayersEditDialog
              className="mt-2 w-full"
              bookingId={reserva.id}
              deporte={reserva.cancha.deporte}
              jugadores={reserva.jugadores}
            />
          )}
        </div>
      </div>
    </div>
  )
}

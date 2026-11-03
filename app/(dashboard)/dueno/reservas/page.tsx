import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, CircleDot, Clock, LandPlot, User, UserCheck, Wallet } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import type { Prisma } from '@/lib/generated/prisma/client'
import { dondeHistorial, dondeProximas } from '@/lib/bookings'
import { clasesGrillaAdaptable } from '@/lib/grid-columns'
import { montoDelHistorial } from '@/lib/historial'
import { estadoDeReserva, venceLaSena } from '@/lib/estado-reserva'
import { calcularPagina } from '@/lib/paginacion'
import { homePorRol } from '@/lib/home-por-rol'
import { ownerBookingsFiltersSchema } from '@/lib/validations/owner-bookings'
import { diaEnPalabras } from '@/lib/fechas'
import { diaDeReserva, momentoActual, turnoYaPaso } from '@/lib/time'
import { Button } from '@/components/ui/button'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { BookingsFilters } from '@/components/bookings-filters'
import { ContactoDelJugador } from '@/components/contacto-del-jugador'
import { AttendanceButtons } from '@/components/attendance-buttons'
import { CuentaRegresivaSena } from '@/components/cuenta-regresiva-sena'
import { CeldaCancha, CeldaMonto } from '@/components/celdas-reserva'
import { EstadoDeDisputa } from '@/components/estado-de-disputa'
import { EstadoVacio } from '@/components/estado-vacio'
import { EtiquetaDeporte } from '@/components/etiqueta-deporte'
import { FranjaDeCancha } from '@/components/franja-de-cancha'
import { FechaDelTurno } from '@/components/fecha-del-turno'
import { TituloConIcono } from '@/components/titulo-con-icono'
import { Paginacion } from '@/components/paginacion'
import {
  leerVista,
  PestaniasDeReservas,
  urlDeReservas,
  type VistaDeReservas,
} from '@/components/pestanias-reservas'
import { RefreshWhenDepositExpires } from '@/components/refresh-when-deposit-expires'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Próximas se muestran como tarjetas, historial y canceladas como tabla.
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
    include: {
      cancha: { include: { complejo: true } },
      jugador: true,
      pago: true,
      disputa: true,
    },
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

export default async function ReservasDelDuenioPage({
  searchParams,
}: PageProps<'/dueno/reservas'>) {
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol !== 'DUENIO') redirect(homePorRol(session.user.rol))

  // ?vista=historial|canceladas elige la pestaña, ?pagina=2 la página y el
  // resto son los filtros del formulario (complejo, deporte, jugador, fechas)
  const parametros = await searchParams
  const vista = leerVista(parametros.vista)
  const filtros = ownerBookingsFiltersSchema.parse(parametros)
  const hayFiltros =
    filtros.complejoId !== undefined ||
    filtros.deporte !== undefined ||
    filtros.jugador !== undefined ||
    filtros.desde !== undefined ||
    filtros.hasta !== undefined

  // Sus complejos, también los dados de baja: sus reservas viejas existen
  const complejos = await db.complejo.findMany({
    where: { duenioId: session.user.id },
    select: { id: true, nombre: true, activo: true },
    orderBy: { nombre: 'asc' },
  })

  // Las reservas de todas las canchas de sus complejos, con los filtros. El
  // duenioId va siempre: aunque en la URL venga el complejo de otro dueño, no
  // trae nada que no sea suyo.
  const deSusCanchasConFiltros: Prisma.ReservaWhereInput = {
    cancha: {
      complejo: { duenioId: session.user.id },
      complejoId: filtros.complejoId,
      deporte: filtros.deporte,
    },
    jugador: filtros.jugador
      ? {
          OR: [
            { nombre: { contains: filtros.jugador, mode: 'insensitive' } },
            { email: { contains: filtros.jugador, mode: 'insensitive' } },
          ],
        }
      : undefined,
    fecha: {
      gte: filtros.desde ? new Date(filtros.desde) : undefined,
      lte: filtros.hasta ? new Date(filtros.hasta) : undefined,
    },
  }

  // Qué es "próxima" o "historial" lo decide la base (ver dondeProximas). Va
  // con AND y no mezclado en el mismo objeto: si no, el filtro de fechas
  // podría pisar las condiciones de la pestaña (o al revés).
  const ahora = momentoActual()
  const dondePorVista: Record<VistaDeReservas, Prisma.ReservaWhereInput> = {
    proximas: { AND: [deSusCanchasConFiltros, dondeProximas(ahora)] },
    historial: { AND: [deSusCanchasConFiltros, dondeHistorial(ahora)] },
    canceladas: { AND: [deSusCanchasConFiltros, { estado: 'CANCELADA' }] },
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
  const { paginaActual, totalPaginas, skip } = calcularPagina(
    parametros.pagina,
    totales[vista],
    porPagina,
  )

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
      urlAnterior={urlDeReservas('/dueno/reservas', vista, paginaActual - 1, filtros)}
      urlSiguiente={urlDeReservas('/dueno/reservas', vista, paginaActual + 1, filtros)}
    />
  )

  // Sin filtros y sin nada en ninguna pestaña: todavía nadie reservó
  const nuncaReservaron = !hayFiltros && totalProximas + totalHistorial + totalCanceladas === 0

  return (
    <main>
      <div className="mb-6">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Reservas</h1>
        <p className="text-muted-foreground mt-1.5">
          {(hayFiltros || totalProximas === 0) &&
            'Los próximos turnos en tus canchas y todo lo que se reservó antes.'}
          {!hayFiltros && totalProximas === 1 && '1 turno por jugarse en tus canchas.'}
          {!hayFiltros &&
            totalProximas > 1 &&
            `${totalProximas} turnos por jugarse en tus canchas.`}
        </p>
      </div>

      {nuncaReservaron ? (
        <EstadoVacio
          titulo="Todavía no hay turnos reservados"
          texto="Cuando un jugador reserve una de tus canchas, va a aparecer acá."
        />
      ) : (
        <>
          <BookingsFilters
            complejos={complejos}
            filtros={filtros}
            campoOculto={vista === 'proximas' ? undefined : { nombre: 'vista', valor: vista }}
            fechasObligatorias={false}
            urlSinFiltros={hayFiltros ? urlDeReservas('/dueno/reservas', vista, 1) : undefined}
          />

          <div className="mt-5">
            <PestaniasDeReservas
              ruta="/dueno/reservas"
              vista={vista}
              totales={totales}
              filtros={filtros}
            />
          </div>

          {reservas.length === 0 && hayFiltros && (
            <EstadoVacio
              titulo="Ninguna reserva cumple los filtros"
              texto="Probá con otro complejo, otro deporte u otras fechas."
            >
              <Button
                variant="secondary"
                render={<Link href={urlDeReservas('/dueno/reservas', vista, 1)} />}
              >
                Limpiar filtros
              </Button>
            </EstadoVacio>
          )}

          {reservas.length === 0 && !hayFiltros && (
            <p className="text-muted-foreground text-sm">
              {vista === 'proximas' && 'No hay turnos próximos en tus canchas.'}
              {vista === 'historial' && 'Todavía no se jugó ningún turno en tus canchas.'}
              {vista === 'canceladas' && 'No hay reservas canceladas.'}
            </p>
          )}

          {reservas.length > 0 && vista === 'proximas' && (
            <>
              {/* Misma grilla que Mis complejos: hasta 4 tarjetas por fila, que
                  se reparten todo el ancho (no sobra un hueco a la derecha) */}
              <div className="@container">
                <div className={`grid gap-5 ${clasesGrillaAdaptable(reservas.length)}`}>
                  {reservas.map((reserva) => (
                    <TarjetaReserva key={reserva.id} reserva={reserva} ahora={ahora} />
                  ))}
                </div>
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
                    {/* w-full en estas dos: se reparten el ancho que sobra, así
                        las demás quedan pegadas a su contenido y ningún hueco
                        se hace muy grande */}
                    <TableHead className="w-full px-3">
                      <TituloConIcono icono={LandPlot}>Cancha</TituloConIcono>
                    </TableHead>
                    <TableHead className="w-full px-3">
                      <TituloConIcono icono={User}>Jugador</TituloConIcono>
                    </TableHead>
                    <TableHead className="px-3">
                      <TituloConIcono icono={CircleDot}>Estado</TituloConIcono>
                    </TableHead>
                    {/* Sin la columna de asistencia (Canceladas), el monto es la
                        última: ahí lleva el padding del borde de la tarjeta */}
                    <TableHead className={vista === 'historial' ? 'px-3' : 'px-3 pr-4'}>
                      <TituloConIcono icono={Wallet}>Monto</TituloConIcono>
                    </TableHead>
                    {vista === 'historial' && (
                      <TableHead className="px-3 pr-4 text-right">
                        <TituloConIcono icono={UserCheck}>Asistencia</TituloConIcono>
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
                      conAsistencia={vista === 'historial'}
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

// Una fila de la tabla de historial o canceladas. En el historial lleva los
// botones de asistencia: el dueño la marca recién cuando el turno terminó.
function FilaReserva({
  reserva,
  ahora,
  conAsistencia,
}: {
  reserva: Reserva
  ahora: { dia: string; hora: string }
  conAsistencia: boolean
}) {
  const dia = diaDeReserva(reserva.fecha)
  const monto = montoDelHistorial(
    {
      estado: reserva.estado,
      asistio: reserva.asistio,
      precioTurno: reserva.precioTurno.toString(),
      descuento: reserva.descuento.toString(),
      pago: reserva.pago && { ...reserva.pago, monto: reserva.pago.monto.toString() },
    },
    turnoYaPaso(dia, reserva.horaInicio),
    'DUENIO',
  )
  const visible = estadoDeReserva(
    {
      estado: reserva.estado,
      asistio: reserva.asistio,
      dia,
      horaInicio: reserva.horaInicio,
      horaFin: reserva.horaFin,
    },
    ahora,
  )
  const seMarcaAsistencia =
    visible === 'FINALIZADA' || visible === 'ASISTIO' || visible === 'NO_SHOW'

  return (
    <TableRow>
      <TableCell className="px-3 pl-4">
        <FechaDelTurno dia={dia} horaInicio={reserva.horaInicio} horaFin={reserva.horaFin} />
      </TableCell>
      <TableCell className="w-full px-3">
        <CeldaCancha
          nombre={reserva.cancha.nombre}
          deporte={reserva.cancha.deporte}
          complejo={reserva.cancha.complejo.nombre}
        />
      </TableCell>
      <TableCell className="w-full px-3">
        {/* -ml: el círculo queda alineado con el título de la columna */}
        <ContactoDelJugador jugador={reserva.jugador} className="-ml-2.5 max-w-60" />
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
      <TableCell className={conAsistencia ? 'px-3' : 'px-3 pr-4'}>
        <CeldaMonto monto={monto} />
      </TableCell>
      {conAsistencia && (
        <TableCell className="px-3 pr-4 text-right">
          {/* Con una disputa la marca queda congelada: mientras está abierta la
              revisa el admin, y una vez resuelta su decisión es definitiva */}
          {reserva.disputa ? (
            <EstadoDeDisputa disputa={reserva.disputa} vista="DUENIO" />
          ) : (
            seMarcaAsistencia && (
              <AttendanceButtons bookingId={reserva.id} asistio={reserva.asistio} />
            )
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
      descuento: reserva.descuento.toString(),
      pago: reserva.pago && { ...reserva.pago, monto: reserva.pago.monto.toString() },
    },
    yaPaso,
    'DUENIO',
  )

  const esperaLaSena = reserva.estado === 'PENDIENTE'
  const venceSena = venceLaSena(reserva.createdAt).toISOString()

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
        <p className="text-muted-foreground mt-2 truncate text-sm">
          <span className="text-foreground font-semibold">{reserva.cancha.nombre}</span> ·{' '}
          {reserva.cancha.complejo.nombre}
        </p>

        {/* Quién reservó: el contacto se abre al tocarlo */}
        <ContactoDelJugador jugador={reserva.jugador} className="bg-muted/60 mt-3" />

        {/* De acá para abajo todas las tarjetas tienen lo mismo a la misma
            altura, esté o no pagada la seña: un renglón con su barra y el
            monto. */}
        <div className="mt-auto pt-3.5">
          {esperaLaSena ? (
            // El dueño ve el mismo reloj que el jugador: cuándo se libera el
            // turno si no pagan la seña
            <>
              <CuentaRegresivaSena venceEn={venceSena} />
              <RefreshWhenDepositExpires venceEn={venceSena} />
            </>
          ) : (
            // Mismo alto que la cuenta regresiva: un renglón y, donde iría la
            // barra, una línea divisoria. min-h: en tarjetas angostas el texto
            // ocupa dos renglones y empuja hacia arriba, sin pisar la línea
            <div className="space-y-1.5">
              <p className="text-muted-foreground flex min-h-7 items-center text-sm">
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
        </div>
      </div>
    </div>
  )
}

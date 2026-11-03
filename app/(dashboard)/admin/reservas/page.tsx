import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CalendarDays, CircleDot, LandPlot, MapPin, Scale, User, Wallet } from 'lucide-react'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { pendientesVencidas } from '@/lib/bookings'
import { estadoDeReserva } from '@/lib/estado-reserva'
import { montoDelHistorial } from '@/lib/historial'
import { homePorRol } from '@/lib/home-por-rol'
import { iniciales } from '@/lib/iniciales'
import { deporteLabels, grupoDeEstadoLabels } from '@/lib/labels'
import { calcularPagina } from '@/lib/paginacion'
import { diaDeHoy, diaDeReserva, momentoActual, turnoYaPaso } from '@/lib/time'
import {
  contarPorGrupo,
  grupoDelEstado,
  gruposDeEstado,
  rangoDeFechas,
  urlDeReservasGlobales,
  type FiltrosDeReservas,
  type GrupoDeEstado,
} from '@/lib/admin-bookings'
import { adminBookingsFiltersSchema } from '@/lib/validations/admin-bookings'
import { BookingsFilters } from '@/components/bookings-filters'
import { BookingStatusBadge } from '@/components/booking-status-badge'
import { CeldaMonto } from '@/components/celdas-reserva'
import { MiniCancha } from '@/components/mini-cancha'
import { EstadoVacio } from '@/components/estado-vacio'
import { FechaDelTurno } from '@/components/fecha-del-turno'
import { Paginacion } from '@/components/paginacion'
import { TituloConIcono } from '@/components/titulo-con-icono'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const FILAS_POR_PAGINA = 20

// Pestañas de estado, con el mismo estilo que las de Reservas y Usuarios:
// la elegida va en verde oscuro y su contador en amarillo. Con px-3 (no
// px-4) para que las 7 entren en una fila en pantallas anchas. shrink-0:
// en celular la fila se desliza de costado en vez de partirse.
function clasePestania(elegida: boolean) {
  return elegida
    ? 'bg-sidebar text-sidebar-foreground inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold'
    : 'text-foreground/80 hover:bg-muted inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium'
}

function claseContador(elegida: boolean) {
  return elegida
    ? 'bg-highlight text-highlight-foreground inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1.5 text-xs font-bold'
    : 'bg-muted inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-full px-1.5 text-xs font-semibold'
}

// Las reservas de la página, con todo lo que muestra la tabla. Del jugador
// solo nombre y email: nunca traer el usuario entero (tiene el passwordHash).
async function getReservasPorId(ids: string[]) {
  return db.reserva.findMany({
    where: { id: { in: ids } },
    include: {
      cancha: { include: { complejo: true } },
      jugador: { select: { nombre: true, email: true } },
      pago: true,
      // Solo lo que usa el link al detalle de la disputa
      disputa: { select: { id: true, estado: true } },
    },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })
}

type Reserva = Awaited<ReturnType<typeof getReservasPorId>>[number]

export default async function AdminReservasPage({ searchParams }: PageProps<'/admin/reservas'>) {
  // El proxy ya filtra por rol, pero la página lo vuelve a chequear (CLAUDE.md:
  // el rol se verifica server-side en cada página)
  const session = await auth()
  if (!session) redirect('/login')
  if (session.user.rol !== 'ADMIN') redirect(homePorRol(session.user.rol))

  const parametros = await searchParams
  const filtrosDeLaUrl = adminBookingsFiltersSchema.parse(parametros)
  const rango = rangoDeFechas(filtrosDeLaUrl.desde, filtrosDeLaUrl.hasta, diaDeHoy())

  // Todos los complejos, también los dados de baja: sus reservas viejas existen.
  // Si en la URL viene un complejo que no existe, se ven todos.
  const complejos = await db.complejo.findMany({
    select: { id: true, nombre: true, activo: true },
    orderBy: { nombre: 'asc' },
  })
  let complejoId: string | undefined = undefined
  for (const complejo of complejos) {
    if (complejo.id === filtrosDeLaUrl.complejoId) complejoId = complejo.id
  }

  const filtros: FiltrosDeReservas = {
    estado: filtrosDeLaUrl.estado,
    complejoId,
    deporte: filtrosDeLaUrl.deporte,
    jugador: filtrosDeLaUrl.jugador,
    desde: rango.desde,
    hasta: rango.hasta,
  }

  // 1) Todas las reservas del período, solo con lo que hace falta para saber
  // su estado. Los estados En curso, Finalizada y No se presentó no están en
  // la base (salen del reloj y de la asistencia): por eso se calculan acá y no
  // se pueden filtrar en el where. El resto de los filtros (complejo, deporte,
  // jugador) sí los resuelve la base, así se traen menos reservas.
  const reservasDelPeriodo = await db.reserva.findMany({
    where: {
      fecha: { gte: new Date(rango.desde), lte: new Date(rango.hasta) },
      cancha: { complejoId, deporte: filtros.deporte },
      jugador: filtros.jugador
        ? {
            OR: [
              { nombre: { contains: filtros.jugador, mode: 'insensitive' } },
              { email: { contains: filtros.jugador, mode: 'insensitive' } },
            ],
          }
        : undefined,
      NOT: pendientesVencidas(),
    },
    select: { id: true, estado: true, asistio: true, fecha: true, horaInicio: true, horaFin: true },
    orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
  })

  // 2) El estado de cada una: se cuentan todas y se guardan las del estado elegido
  const ahora = momentoActual()
  const grupos: GrupoDeEstado[] = []
  const idsDelEstadoElegido: string[] = []
  for (const reserva of reservasDelPeriodo) {
    const estado = estadoDeReserva(
      {
        estado: reserva.estado,
        asistio: reserva.asistio,
        dia: diaDeReserva(reserva.fecha),
        horaInicio: reserva.horaInicio,
        horaFin: reserva.horaFin,
      },
      ahora,
    )
    const grupo = grupoDelEstado(estado)
    grupos.push(grupo)
    if (filtros.estado === undefined || grupo === filtros.estado) {
      idsDelEstadoElegido.push(reserva.id)
    }
  }
  const conteo = contarPorGrupo(grupos)

  // 3) Recién ahora se traen completas, y solo las de esta página
  const { paginaActual, totalPaginas, skip } = calcularPagina(
    parametros.pagina,
    idsDelEstadoElegido.length,
    FILAS_POR_PAGINA,
  )
  const idsDeLaPagina = idsDelEstadoElegido.slice(skip, skip + FILAS_POR_PAGINA)
  const reservas = await getReservasPorId(idsDeLaPagina)

  return (
    <main>
      <h1 className="font-heading text-4xl font-bold tracking-tight">Reservas</h1>
      <p className="text-muted-foreground mt-1.5 max-w-2xl">
        Todas las reservas de la plataforma en el período elegido.
      </p>

      <BookingsFilters
        complejos={complejos}
        filtros={filtros}
        campoOculto={
          filtros.estado === undefined ? undefined : { nombre: 'estado', valor: filtros.estado }
        }
        fechasObligatorias
      />

      {reservas.length === 0 ? (
        <>
          <div className="bg-card shadow-soft mt-5 flex flex-wrap gap-1 rounded-2xl p-1">
            <PestaniasDeEstado
              filtros={filtros}
              total={reservasDelPeriodo.length}
              conteo={conteo}
            />
          </div>
          <div className="mt-5">
            <EstadoVacio
              titulo="No hay reservas con estos filtros"
              texto="Probá con otro período, otro complejo, otro deporte u otro estado."
            />
          </div>
        </>
      ) : (
        // @container: las columnas aparecen según el ancho de la tarjeta, no
        // de la pantalla (con el sidebar abierto la tarjeta es más angosta).
        // overflow-clip (no hidden) y sin el <Table> de shadcn (que envuelve
        // la tabla en un div con overflow-x-auto): cualquier scroll en el
        // medio hace que el encabezado sticky deje de quedar fijo.
        <div className="bg-card shadow-card @container mt-5 overflow-clip rounded-2xl">
          <table className="w-full caption-bottom text-sm">
            {/* Encabezado fijo al bajar: las pestañas de estado y los títulos
                de las columnas, así nunca se pierde qué es cada dato. Se pega
                a 16px del borde (top-4) y una franja del color del fondo (el
                before: de la primera celda) tapa esos 16px, para que no se
                vean las filas pasando por arriba.
                La línea de abajo también es una sombra (inset) y no un border:
                con la tabla en border-collapse, los bordes no acompañan al sticky */}
            <TableHeader className="bg-card sticky top-4 z-10 [&_tr]:border-0">
              <tr>
                <th
                  colSpan={5}
                  className="before:bg-background relative px-2 pt-2 text-left font-normal before:absolute before:inset-x-0 before:bottom-full before:h-4"
                >
                  {/* En celular se desliza de costado; desde @xl se parte en
                      dos filas si no entra. [contain:inline-size]: que no
                      ensanche la tabla con su ancho */}
                  <div className="flex gap-1 overflow-x-auto contain-[inline-size] scrollbar-none @xl:flex-wrap">
                    <PestaniasDeEstado
                      filtros={filtros}
                      total={reservasDelPeriodo.length}
                      conteo={conteo}
                    />
                  </div>
                </th>
              </tr>
              <TableRow className="border-0 hover:bg-transparent [&>th]:shadow-[inset_0_-1px_0_var(--color-border)]">
                <TableHead className="pl-4">
                  <TituloConIcono icono={CalendarDays}>Turno</TituloConIcono>
                </TableHead>
                <TableHead className="hidden w-full @xl:table-cell">
                  <TituloConIcono icono={LandPlot}>Cancha</TituloConIcono>
                </TableHead>
                <TableHead className="hidden w-full @3xl:table-cell">
                  <TituloConIcono icono={User}>Jugador</TituloConIcono>
                </TableHead>
                <TableHead className="pr-4 @5xl:pr-2">
                  <TituloConIcono icono={CircleDot}>Estado</TituloConIcono>
                </TableHead>
                <TableHead className="hidden pr-4 @5xl:table-cell">
                  <TituloConIcono icono={Wallet}>Monto</TituloConIcono>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservas.map((reserva) => (
                <FilaReserva key={reserva.id} reserva={reserva} ahora={ahora} />
              ))}
            </TableBody>
          </table>
          <Paginacion
            paginaActual={paginaActual}
            totalPaginas={totalPaginas}
            desde={skip + 1}
            hasta={skip + reservas.length}
            total={idsDelEstadoElegido.length}
            urlAnterior={urlDeReservasGlobales({ ...filtros, pagina: paginaActual - 1 })}
            urlSiguiente={urlDeReservasGlobales({ ...filtros, pagina: paginaActual + 1 })}
          />
        </div>
      )}
    </main>
  )
}

// Una pestaña por estado: cada una es un link que filtra y muestra cuántas
// hay. Cambiar de estado vuelve a la página 1 (el link no lleva pagina).
function PestaniasDeEstado({
  filtros,
  total,
  conteo,
}: {
  filtros: FiltrosDeReservas
  total: number
  conteo: Record<GrupoDeEstado, number>
}) {
  return (
    <>
      <Link
        href={urlDeReservasGlobales({ ...filtros, estado: undefined })}
        className={clasePestania(filtros.estado === undefined)}
      >
        Todas
        <span className={claseContador(filtros.estado === undefined)}>{total}</span>
      </Link>
      {gruposDeEstado.map((grupo) => (
        <Link
          key={grupo}
          href={urlDeReservasGlobales({ ...filtros, estado: grupo })}
          className={clasePestania(filtros.estado === grupo)}
        >
          {grupoDeEstadoLabels[grupo]}
          <span className={claseContador(filtros.estado === grupo)}>{conteo[grupo]}</span>
        </Link>
      ))}
    </>
  )
}

function FilaReserva({
  reserva,
  ahora,
}: {
  reserva: Reserva
  ahora: { dia: string; hora: string }
}) {
  const dia = diaDeReserva(reserva.fecha)
  // El monto, contado como lo ve el complejo (cobrado, retenido, devuelto)
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

  return (
    <TableRow>
      <TableCell className="pl-4">
        <FechaDelTurno dia={dia} horaInicio={reserva.horaInicio} horaFin={reserva.horaFin} />
        {/* Cuando la tarjeta es angosta no entra la columna Cancha: va acá abajo */}
        <div className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs whitespace-normal @xl:hidden">
          <MiniCancha deporte={reserva.cancha.deporte} className="h-3.5 w-5.5 rounded-[3px]" />
          {reserva.cancha.nombre} · {reserva.cancha.complejo.nombre}
        </div>
      </TableCell>
      <TableCell className="hidden w-full @xl:table-cell">
        <div className="flex items-center gap-3">
          <MiniCancha deporte={reserva.cancha.deporte} className="h-10 w-16 rounded-lg" />
          <div>
            {/* El deporte va en texto porque el dibujo de fútbol es el mismo
                para 5, 7 y 11 */}
            <p className="font-medium">
              {reserva.cancha.nombre}
              <span className="text-muted-foreground font-normal">
                {' '}
                · {deporteLabels[reserva.cancha.deporte]}
              </span>
            </p>
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <MapPin className="size-3 shrink-0" />
              {reserva.cancha.complejo.nombre}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden w-full @3xl:table-cell">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {iniciales(reserva.jugador.nombre)}
          </div>
          <div>
            <p className="font-medium">{reserva.jugador.nombre}</p>
            <p className="text-muted-foreground text-xs">{reserva.jugador.email}</p>
          </div>
        </div>
      </TableCell>
      {/* Muestra el estado real: una "Asistió" se cuenta en Finalizadas, pero
          acá se ve como Asistió */}
      <TableCell className="pr-4 @5xl:pr-2">
        <BookingStatusBadge
          estado={reserva.estado}
          asistio={reserva.asistio}
          dia={dia}
          horaInicio={reserva.horaInicio}
          horaFin={reserva.horaFin}
          ahoraInicial={ahora}
        />
        {/* La disputa es sobre este estado (el jugador cuestiona la falta), por
            eso el link va acá y no en una columna aparte. En rojo mientras
            espera una decisión, igual que en el panel del admin. */}
        {reserva.disputa && (
          <Link
            href={`/admin/disputas/${reserva.disputa.id}`}
            className={
              reserva.disputa.estado === 'ABIERTA'
                ? 'text-destructive mt-1.5 flex items-center gap-1 text-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground mt-1.5 flex items-center gap-1 text-xs font-medium'
            }
          >
            <Scale className="size-3 shrink-0" />
            Ver disputa
          </Link>
        )}
      </TableCell>
      <TableCell className="hidden pr-4 @5xl:table-cell">
        <CeldaMonto monto={monto} />
      </TableCell>
    </TableRow>
  )
}

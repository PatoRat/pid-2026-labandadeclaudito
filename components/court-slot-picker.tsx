'use client'

import { useEffect, useRef, useState } from 'react'
import { format, parse } from 'date-fns'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Moon,
  Sun,
  Sunset,
  Wallet,
} from 'lucide-react'
import type { Deporte } from '@/lib/generated/prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { MINUTOS_PARA_PAGAR_SENA, venceLaSena } from '@/lib/estado-reserva'
import { CuentaRegresivaSena } from '@/components/cuenta-regresiva-sena'
import { diaEnPalabras } from '@/lib/fechas'
import {
  jugadoresFaltantes,
  maxJugadoresPorDeporte,
  textoCupo,
  textoJugadoresFaltantes,
} from '@/lib/jugadores'
import { formatPrecio, mesesCortos, nombresCortosDeDias } from '@/lib/labels'
import { diaDeHoy, diasParaReservar, formatAdvanceTime } from '@/lib/time'

type Slot = {
  horaInicio: string
  horaFin: string
  disponible: boolean
  // reservada: la tomó otra reserva; jugadores: cuántos cargó (null = completa)
  reservada: boolean
  jugadores: number | null
  // reservaId: id de la reserva que ocupa el turno; puedeUnirse: el que mira
  // puede sumarse a esa reserva incompleta
  reservaId: string | null
  puedeUnirse: boolean
  precio: string
}
// reservando -> pendiente (reserva creada, falta la seña) -> pagando -> exito
// uniendo -> unido: sumarse a una reserva incompleta de otro jugador
type EstadoConfirmacion =
  'idle' | 'reservando' | 'pendiente' | 'pagando' | 'exito' | 'uniendo' | 'unido' | 'error'

// Los horarios se agrupan por momento del día ("desde" incluido, "hasta" no)
const periodosDelDia = [
  { nombre: 'Mañana', icono: Sun, desde: '00:00', hasta: '12:00' },
  { nombre: 'Tarde', icono: Sunset, desde: '12:00', hasta: '19:00' },
  { nombre: 'Noche', icono: Moon, desde: '19:00', hasta: '24:00' },
]

export function CourtSlotPicker({
  courtId,
  courtName,
  deporte,
  precioBase,
  fechaInicial,
}: {
  courtId: string
  courtName: string
  deporte: Deporte
  precioBase: string
  fechaInicial?: string
}) {
  const maxJugadores = maxJugadoresPorDeporte[deporte]
  // fechaInicial viene como YYYY-MM-DD de la búsqueda. Se arma con parse (fecha
  // local): new Date('2026-10-03') sería medianoche UTC y en Argentina mostraría
  // el día anterior. Una fecha que ya pasó no sirve, se arranca en hoy.
  const [fecha, setFecha] = useState(() => {
    if (fechaInicial !== undefined && fechaInicial >= diaDeHoy()) {
      return parse(fechaInicial, 'yyyy-MM-dd', new Date())
    }
    return new Date()
  })
  const [slots, setSlots] = useState<Slot[]>([])
  const [cargando, setCargando] = useState(true)
  const [porcentajeSena, setPorcentajeSena] = useState(0)
  const [minAdvanceMinutes, setMinAdvanceMinutes] = useState(0)
  const [horaSeleccionada, setHoraSeleccionada] = useState<string | null>(null)
  // Si el turno se reserva completo (default) o falta gente; cuántos hay.
  // La cantidad es string para poder borrarla y escribir libre: se normaliza
  // (acota a 1..máximo) recién al salir del campo (onBlur).
  const [completa, setCompleta] = useState(true)
  const [cantidadTexto, setCantidadTexto] = useState('1')
  const [estado, setEstado] = useState<EstadoConfirmacion>('idle')
  const [mensajeError, setMensajeError] = useState('')
  const [reservaHecha, setReservaHecha] = useState<{
    id: string
    hora: string
    montoSena: number
    venceEn: string
  } | null>(null)

  // El día elegido se centra en la tira (al abrir y al cambiar de día)
  const diaElegidoRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    diaElegidoRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [fecha])

  async function cargarDisponibilidad(fechaConsultada: Date) {
    const fechaISO = format(fechaConsultada, 'yyyy-MM-dd')
    const res = await fetch(`/api/courts/${courtId}/availability?fecha=${fechaISO}`)
    if (!res.ok) return
    const json = await res.json()
    setSlots(json.slots)
    setPorcentajeSena(json.porcentajeSena)
    setMinAdvanceMinutes(json.minAdvanceMinutes)
  }

  useEffect(() => {
    let ignore = false
    const fechaISO = format(fecha, 'yyyy-MM-dd')
    async function cargar() {
      // Si el server falla (por ejemplo, la base no responde) la respuesta no
      // es JSON: se avisa en vez de dejar los turnos cargando para siempre.
      let json = null
      try {
        const res = await fetch(`/api/courts/${courtId}/availability?fecha=${fechaISO}`)
        if (res.ok) json = await res.json()
      } catch {
        json = null
      }
      if (ignore) return
      setCargando(false)
      if (json === null) {
        setSlots([])
        setMensajeError('No pudimos cargar los horarios. Probá de nuevo en un rato.')
        setEstado('error')
        return
      }
      setSlots(json.slots)
      setPorcentajeSena(json.porcentajeSena)
      setMinAdvanceMinutes(json.minAdvanceMinutes)
    }
    cargar()
    return () => {
      ignore = true
    }
  }, [fecha, courtId])

  // Grilla en vivo: cada 5 segundos vuelve a pedir la disponibilidad. Así, si
  // otro jugador reserva un turno, acá aparece tachado sin recargar la página.
  // Es solo visual: el que impide reservar dos veces el mismo turno es el server.
  useEffect(() => {
    let activo = true
    const fechaISO = format(fecha, 'yyyy-MM-dd')
    const id = setInterval(async () => {
      // Con la pestaña en segundo plano nadie la está mirando: no se consulta
      if (document.visibilityState !== 'visible') return
      const res = await fetch(`/api/courts/${courtId}/availability?fecha=${fechaISO}`)
      // Si mientras tanto cambió la fecha o se cerró, esta respuesta ya no sirve
      if (!activo || !res.ok) return
      const json = await res.json()
      setSlots(json.slots)
    }, 5000)
    return () => {
      activo = false
      clearInterval(id)
    }
  }, [fecha, courtId])

  // Si el jugador no paga la seña a tiempo: se avisa y se recarga la grilla,
  // donde el turno ya aparece libre. Es un temporizador del navegador, solo
  // mientras esta pantalla está abierta.
  useEffect(() => {
    if (!reservaHecha || estado === 'exito' || estado === 'pagando') return

    const msHastaVencer = new Date(reservaHecha.venceEn).getTime() - Date.now()
    const id = setTimeout(async () => {
      setReservaHecha(null)
      setMensajeError(
        `Se venció el plazo de ${MINUTOS_PARA_PAGAR_SENA} minutos para pagar la seña. El turno se liberó.`,
      )
      setEstado('error')

      const fechaISO = format(fecha, 'yyyy-MM-dd')
      const res = await fetch(`/api/courts/${courtId}/availability?fecha=${fechaISO}`)
      if (res.ok) {
        const json = await res.json()
        setSlots(json.slots)
      }
    }, msHastaVencer + 1000)

    return () => clearTimeout(id)
  }, [reservaHecha, estado, fecha, courtId])

  const slotSeleccionado = slots.find((slot) => slot.horaInicio === horaSeleccionada)
  // El turno elegido dejó de estar disponible y tampoco se puede sumar: lo tomó
  // otro mientras lo miraba, o se completó (lo trajo la grilla en vivo)
  const turnoElegidoSeOcupo =
    slotSeleccionado !== undefined && !slotSeleccionado.disponible && !slotSeleccionado.puedeUnirse
  const montoSenaSeleccionada = slotSeleccionado
    ? (Number(slotSeleccionado.precio) * porcentajeSena) / 100
    : 0

  // Normaliza el texto del input a un entero válido (1..máximo) para mandarlo.
  // El server igual re-normaliza.
  function cantidadParaMandar() {
    const n = parseInt(cantidadTexto, 10)
    if (Number.isNaN(n) || n < 1) return 1
    if (n > maxJugadores) return maxJugadores
    return n
  }

  // Paso 1: la reserva se crea PENDIENTE (de seña). El turno ya queda tomado.
  async function reservar() {
    if (!horaSeleccionada || !slotSeleccionado) return
    setMensajeError('')
    setEstado('reservando')

    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canchaId: courtId,
        fecha: format(fecha, 'yyyy-MM-dd'),
        horaInicio: horaSeleccionada,
        // Completa = no se manda; incompleta = cuántos jugadores hay
        jugadores: completa ? undefined : cantidadParaMandar(),
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setReservaHecha({
        id: json.reserva.id,
        hora: horaSeleccionada,
        montoSena: montoSenaSeleccionada,
        venceEn: venceLaSena(new Date(json.reserva.createdAt)).toISOString(),
      })
      setHoraSeleccionada(null)
      setEstado('pendiente')
      await cargarDisponibilidad(fecha)
      return
    }
    setMensajeError(json.error)
    setEstado('error')
    // Si falló porque otro lo reservó, que el turno aparezca tachado ya, sin
    // esperar al próximo refresco de la grilla en vivo
    await cargarDisponibilidad(fecha)
  }

  // Paso 2: pagar la seña pasa la reserva a CONFIRMADA.
  async function pagarSena() {
    if (!reservaHecha) return
    setMensajeError('')
    setEstado('pagando')

    // Delay artificial: acá "se simula" el cobro de la seña, no hay pasarela
    // real. El monto lo calcula y congela el server.
    await new Promise((resolve) => setTimeout(resolve, 900))

    const res = await fetch(`/api/bookings/${reservaHecha.id}/deposit`, { method: 'POST' })
    const json = await res.json()
    if (res.ok) {
      setEstado('exito')
      return
    }
    setMensajeError(json.error)
    setEstado('error')
  }

  // Cuánto se suma el que se une, acotado a lo que falta del turno elegido.
  function cantidadParaUnirse() {
    const faltan = slotSeleccionado ? jugadoresFaltantes(deporte, slotSeleccionado.jugadores) : 1
    const n = parseInt(cantidadTexto, 10)
    if (Number.isNaN(n) || n < 1) return 1
    if (n > faltan) return faltan
    return n
  }

  // Sumarse a una reserva incompleta de otro jugador. No se paga nada.
  async function unirse() {
    if (!slotSeleccionado || !slotSeleccionado.reservaId) return
    setMensajeError('')
    setEstado('uniendo')

    const res = await fetch(`/api/bookings/${slotSeleccionado.reservaId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadores: cantidadParaUnirse() }),
    })
    const json = await res.json()
    if (res.ok) {
      setHoraSeleccionada(null)
      setEstado('unido')
      await cargarDisponibilidad(fecha)
      return
    }
    setMensajeError(json.error)
    setEstado('error')
    await cargarDisponibilidad(fecha)
  }

  // Tira de días: todos los que se pueden reservar (hoy + 30)
  const dias = diasParaReservar()
  const diaElegido = format(fecha, 'yyyy-MM-dd')

  function elegirDia(dia: string) {
    setFecha(parse(dia, 'yyyy-MM-dd', new Date()))
    setCargando(true)
    setHoraSeleccionada(null)
    setEstado('idle')
    setReservaHecha(null)
    setCompleta(true)
    setCantidadTexto('1')
  }

  // El pie (fijo abajo del sheet) aparece cuando hay algo para hacer o avisar
  const hayPie =
    turnoElegidoSeOcupo ||
    (horaSeleccionada !== null && slotSeleccionado !== undefined) ||
    reservaHecha !== null ||
    estado === 'unido' ||
    (estado === 'error' && mensajeError !== '')

  function botonDeTurno(slot: Slot) {
    const seleccionado = slot.horaInicio === horaSeleccionada
    const esPrecioEspecial = slot.precio !== precioBase
    // Un turno sin lugar: ni libre ni para sumarse. Va tachado y deshabilitado.
    const sinLugar = !slot.disponible && !slot.puedeUnirse
    return (
      <button
        key={slot.horaInicio}
        type="button"
        disabled={sinLugar}
        onClick={() => {
          // Si la reserva anterior ya quedó pagada, se olvida: si no,
          // volvería a aparecer su "Pagar seña" con la cuenta regresiva.
          // Si todavía está pendiente, se queda (falta pagarla).
          if (estado === 'exito') setReservaHecha(null)
          setHoraSeleccionada(slot.horaInicio)
          setEstado('idle')
          setMensajeError('')
          setCompleta(true)
          setCantidadTexto('1')
        }}
        className={
          sinLugar
            ? 'bg-muted text-muted-foreground flex min-h-11 cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-sm font-medium opacity-60'
            : seleccionado
              ? 'bg-primary text-primary-foreground shadow-button flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-sm font-bold'
              : slot.puedeUnirse
                ? 'bg-clay/12 text-clay-foreground shadow-soft hover:bg-clay/20 flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-sm font-semibold transition-colors'
                : 'bg-card text-card-foreground shadow-soft hover:bg-accent hover:text-accent-foreground flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-sm font-semibold transition-colors'
        }
      >
        {/* En un turno sin lugar la hora va tachada; si se puede sumar, no. El
            precio y el cupo se leen igual, por eso el line-through va solo en la
            hora. */}
        <span className={sinLugar ? 'line-through' : undefined}>{slot.horaInicio}</span>
        {esPrecioEspecial && (slot.disponible || slot.reservada) && (
          <span className="text-[10px] leading-none font-normal opacity-80">
            {formatPrecio(slot.precio)}
          </span>
        )}
        {slot.reservada && (
          <span className="text-[10px] leading-none font-normal opacity-80">
            {textoCupo(deporte, slot.jugadores)}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Tira de días: se desliza de costado y el elegido queda centrado */}
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Calendar className="size-3.5" />
          Elegí el día
        </p>
        {/* Entran 5 días enteros (el ancho se reparte entre 5): ninguno queda
            cortado contra el borde, y como es impar, el elegido queda centrado
            con el mismo margen a los dos lados.
            py-2: lugar para que la sombra de los días no quede cortada */}
        <div className="-mx-4 grid auto-cols-[calc((100%-4*--spacing(2))/5)] grid-flow-col gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none]">
          {dias.map((dia, indice) => {
            const elegido = dia === diaElegido
            let nombre = nombresCortosDeDias[new Date(`${dia}T00:00:00Z`).getUTCDay()]
            if (indice === 0) nombre = 'Hoy'
            if (indice === 1) nombre = 'Mañana'
            return (
              <button
                key={dia}
                ref={elegido ? diaElegidoRef : undefined}
                type="button"
                aria-pressed={elegido}
                onClick={() => elegirDia(dia)}
                className={
                  elegido
                    ? 'bg-primary text-primary-foreground shadow-button flex flex-col items-center rounded-2xl py-2.5'
                    : 'bg-card shadow-soft hover:bg-accent flex flex-col items-center rounded-2xl py-2.5 transition-colors'
                }
              >
                <span className="text-[11px] font-medium">{nombre}</span>
                <span className="font-heading text-2xl leading-tight font-bold">
                  {Number(dia.slice(8))}
                </span>
                <span className="text-[10px] uppercase opacity-75">
                  {mesesCortos[Number(dia.slice(5, 7)) - 1]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="size-3.5" />
            Horarios
          </p>
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span className="size-2 animate-pulse rounded-full bg-green-500" />
            En vivo
          </span>
        </div>

        {minAdvanceMinutes > 0 && (
          <p className="text-muted-foreground text-sm">
            Los turnos se reservan con al menos {formatAdvanceTime(minAdvanceMinutes)} de
            anticipación.
          </p>
        )}

        {cargando ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-xl" />
            ))}
          </div>
        ) : (
          // Agrupados por momento del día; los grupos sin turnos no se muestran
          periodosDelDia.map((periodo) => {
            const turnos = slots.filter(
              (slot) => slot.horaInicio >= periodo.desde && slot.horaInicio < periodo.hasta,
            )
            if (turnos.length === 0) return null
            const libres = turnos.filter((slot) => slot.disponible).length
            const Icono = periodo.icono
            return (
              <div key={periodo.nombre}>
                <p className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
                  <Icono className="size-3.5" />
                  {periodo.nombre}
                  {libres === 0 ? (
                    <span className="opacity-70">· sin turnos libres</span>
                  ) : (
                    <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 font-semibold">
                      {libres === 1 ? '1 libre' : `${libres} libres`}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
                  {turnos.map((slot) => botonDeTurno(slot))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pie fijo abajo del sheet: resumen para reservar, pago de la seña,
          confirmación o error. mt-auto lo empuja abajo si sobra lugar. */}
      {hayPie && (
        <div className="bg-card sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 rounded-t-3xl px-5 pt-4 pb-5 shadow-[0_-14px_28px_-18px_rgb(0_0_0/0.45)]">
          {turnoElegidoSeOcupo && (
            <p className="text-destructive text-sm">
              Otro jugador acaba de reservar las {horaSeleccionada}. Elegí otro horario.
            </p>
          )}

          {horaSeleccionada && slotSeleccionado && slotSeleccionado.disponible && (
            <div className="flex flex-col gap-3">
              <p className="font-heading text-lg font-bold">
                {diaEnPalabras(diaElegido)} · {horaSeleccionada} a {slotSeleccionado.horaFin} hs
              </p>
              {/* El desglose en tres renglones: cuánto sale, cuánto es la seña
                  y cuánto queda para pagar en la cancha */}
              <div className="space-y-1.5 text-sm">
                <p className="text-muted-foreground flex justify-between gap-3">
                  <span>
                    Precio del turno
                    {slotSeleccionado.precio !== precioBase && ' (precio especial)'}
                  </span>
                  <span>{formatPrecio(slotSeleccionado.precio)}</span>
                </p>
                <p className="flex justify-between gap-3 font-semibold">
                  <span>Seña del {porcentajeSena}% para confirmar</span>
                  <span className="text-primary">{formatPrecio(montoSenaSeleccionada)}</span>
                </p>
                <p className="text-muted-foreground flex justify-between gap-3">
                  <span>El resto se paga en la cancha</span>
                  <span>
                    {formatPrecio(Number(slotSeleccionado.precio) - montoSenaSeleccionada)}
                  </span>
                </p>
              </div>

              {/* Completa o falta gente. La seña no cambia; si está incompleta
                  se carga cuántos jugadores hay y se muestra cuántos faltan.
                  Este subtexto va en su propio renglón, aparte del "(precio
                  especial)" de arriba, así conviven sin pisarse. */}
              <div className="space-y-2">
                <Label>¿Ya tenés el equipo completo?</Label>
                <RadioGroup
                  value={completa ? 'completa' : 'incompleta'}
                  onValueChange={(valor) => setCompleta(valor === 'completa')}
                  className="flex gap-4"
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="completa" />
                    Completa
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <RadioGroupItem value="incompleta" />
                    Falta gente
                  </label>
                </RadioGroup>

                {!completa && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cantidadJugadores">Cuántos jugadores son</Label>
                    <Input
                      id="cantidadJugadores"
                      type="number"
                      min={1}
                      max={maxJugadores}
                      value={cantidadTexto}
                      // Se escribe libre; se acota a 1..máximo al salir del campo
                      onChange={(e) => setCantidadTexto(e.target.value)}
                      onBlur={() => setCantidadTexto(String(cantidadParaMandar()))}
                    />
                    <p className="text-muted-foreground text-sm">
                      {textoJugadoresFaltantes(deporte, cantidadParaMandar()) ??
                        `Con ${maxJugadores} jugadores queda completa.`}
                    </p>
                  </div>
                )}
              </div>

              <Button size="lg" onClick={reservar} disabled={estado === 'reservando'}>
                {estado === 'reservando' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {estado === 'reservando' ? 'Reservando...' : 'Reservar'}
              </Button>
            </div>
          )}

          {/* Turno de otro equipo al que le falta gente: te podés sumar sin seña */}
          {horaSeleccionada && slotSeleccionado && slotSeleccionado.puedeUnirse && (
            <div className="flex flex-col gap-3">
              <p className="font-heading text-lg font-bold">
                {diaEnPalabras(diaElegido)} · {horaSeleccionada} a {slotSeleccionado.horaFin} hs
              </p>
              <p className="text-muted-foreground text-sm">
                Este turno ya lo reservó otro equipo y le falta gente. Podés sumarte sin pagar seña.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="cantidadParaUnirse">Cuántos se suman</Label>
                <Input
                  id="cantidadParaUnirse"
                  type="number"
                  min={1}
                  max={jugadoresFaltantes(deporte, slotSeleccionado.jugadores)}
                  value={cantidadTexto}
                  // Se escribe libre; se acota a 1..lo que falta al salir del campo
                  onChange={(e) => setCantidadTexto(e.target.value)}
                  onBlur={() => setCantidadTexto(String(cantidadParaUnirse()))}
                />
                <p className="text-muted-foreground text-sm">
                  {textoJugadoresFaltantes(deporte, slotSeleccionado.jugadores)} (
                  {textoCupo(deporte, slotSeleccionado.jugadores)})
                </p>
              </div>
              <Button size="lg" onClick={unirse} disabled={estado === 'uniendo'}>
                {estado === 'uniendo' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                {estado === 'uniendo' ? 'Sumándote...' : 'Sumarte a este turno'}
              </Button>
            </div>
          )}

          {estado === 'unido' && (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Te sumaste al turno</p>
                <p className="text-muted-foreground text-xs">
                  Ya figurás en esa reserva. No tenés que pagar seña.
                </p>
              </div>
            </div>
          )}

          {reservaHecha && estado !== 'exito' && (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold">
                  Reservaste {courtName} a las {reservaHecha.hora} hs
                </p>
                <p className="text-muted-foreground text-xs">
                  Pagá la seña para confirmar el turno; si no, el turno se libera.
                </p>
              </div>
              <CuentaRegresivaSena venceEn={reservaHecha.venceEn} />
              <Button onClick={pagarSena} disabled={estado === 'pagando'}>
                {estado === 'pagando' ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wallet className="size-3.5" />
                )}
                {estado === 'pagando'
                  ? 'Pagando seña...'
                  : `Pagar seña ${formatPrecio(reservaHecha.montoSena)}`}
              </Button>
            </div>
          )}

          {estado === 'exito' && reservaHecha && (
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="text-primary mt-0.5 size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Reserva confirmada</p>
                <p className="text-muted-foreground text-xs">
                  {courtName} a las {reservaHecha.hora} hs — seña de{' '}
                  {formatPrecio(reservaHecha.montoSena)} pagada (simulado).
                </p>
                <Link
                  href="/jugador/reservas"
                  className="text-primary mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  Ver mis reservas
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* Si el turno elegido lo tomó otro, ya se ve el aviso de arriba */}
          {estado === 'error' && mensajeError && !turnoElegidoSeOcupo && (
            <p className="text-destructive text-sm">{mensajeError}</p>
          )}
        </div>
      )}
    </div>
  )
}

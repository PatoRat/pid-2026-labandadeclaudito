import Image from 'next/image'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import Link from 'next/link'
import { ImageIcon, X } from 'lucide-react'
import { formatPrecio } from '@/lib/labels'
import { activeFilterChips, filtersToQueryString, searchComplexes } from '@/lib/court-search'
import { getPartidosAbiertos } from '@/lib/partidos-abiertos'
import { TarjetaPartidoAbierto } from '@/components/tarjeta-partido-abierto'
import { searchCourtsSchema } from '@/lib/validations/court-search'
import { clasesGrillaAdaptable } from '@/lib/grid-columns'
import { deportesDistintos, precioMasBajo } from '@/lib/resumen-complejo'
import {
  bloqueosDelDia,
  bloqueosEnLaFranja,
  resumenBloqueosParaElJugador,
  type BloqueoDelDia,
} from '@/lib/blocks'
import { Button } from '@/components/ui/button'
import { SearchFiltersSheet } from '@/components/search-filters-sheet'
import { FiltrosDeBusqueda } from '@/components/filtros-de-busqueda'
import { EtiquetaDeporte } from '@/components/etiqueta-deporte'
import { Estrellas } from '@/components/estrellas'
import { EstadoVacio } from '@/components/estado-vacio'
import { AvisoBloqueo } from '@/components/aviso-bloqueo'

export default async function BusquedaCanchasPage({ searchParams }: PageProps<'/jugador/canchas'>) {
  const session = await auth()
  if (!session) redirect('/login')

  const sp = await searchParams
  const filtros = searchCourtsSchema.parse(sp)
  // Modo "ver reservas incompletas": el schema ignora este parámetro, se lee aparte
  const verIncompletas = sp.incompletas === '1'

  const filtrosAplicados = activeFilterChips(filtros)

  // Arma un link conservando el modo actual (incompletas o no)
  function urlConModo(queryString: string) {
    if (!verIncompletas) return `/jugador/canchas${queryString}`
    return `/jugador/canchas${queryString === '' ? '?' : `${queryString}&`}incompletas=1`
  }

  // En modo incompletas se traen las reservas abiertas; si no, los complejos.
  const partidos = verIncompletas ? await getPartidosAbiertos(session.user.id, filtros) : []
  const complejos = verIncompletas ? [] : await searchComplexes(filtros, session.user.id)

  // Los bloqueos se avisan solo si el jugador eligió un día: sin fecha no hay
  // un día del que hablar (otro día esa cancha puede estar libre). Y si eligió
  // horario, cuentan solo los que caen en ese horario. En gris va solo el
  // complejo que ese día no tiene ningún turno porque está todo bloqueado.
  let bloqueos: BloqueoDelDia[] = []
  if (!verIncompletas && filtros.fecha !== undefined) {
    const idsDeCanchas: string[] = []
    for (const complejo of complejos) {
      for (const cancha of complejo.canchas) {
        idsDeCanchas.push(cancha.id)
      }
    }
    const bloqueosDelDiaBuscado = await bloqueosDelDia(idsDeCanchas, new Date(filtros.fecha))
    bloqueos = bloqueosEnLaFranja(bloqueosDelDiaBuscado, filtros.horaDesde, filtros.horaHasta)
  }

  // En xl el botón "Filtros" se oculta: sin chips, la fila de arriba queda
  // vacía y los resultados suben para quedar alineados con los filtros.
  const margenResultados = filtrosAplicados.length === 0 ? 'mt-8 xl:mt-0' : 'mt-8'

  return (
    <main>
      <div className="mb-7">
        <h1 className="font-heading text-4xl font-bold tracking-tight">Buscar canchas</h1>
        <p className="text-muted-foreground mt-1.5">
          Decinos dónde y cuándo querés jugar, y te mostramos qué hay libre.
        </p>
      </div>

      {/* En xl los filtros están siempre abiertos en una columna a la izquierda
          (todo el que entra a buscar filtra) y scrollean con la página; antes
          se abren desde el botón "Filtros" (sheet). */}
      <div className="grid gap-8 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <div className="bg-card shadow-card rounded-3xl px-5 pt-5">
            <h2 className="font-heading mb-5 text-xl font-bold">Filtros</h2>
            <FiltrosDeBusqueda
              filtros={filtros}
              idPrefijo="lateral-"
              incompletas={verIncompletas}
            />
          </div>
        </aside>

        <section>
          <div className="flex flex-wrap items-center gap-2">
            <SearchFiltersSheet
              filtros={filtros}
              cantidadDeFiltros={filtrosAplicados.length}
              incompletas={verIncompletas}
            />

            {filtrosAplicados.map((filtro) => (
              <Link
                key={filtro.label}
                href={urlConModo(filtersToQueryString(filtro.withoutIt))}
                aria-label={`Quitar filtro ${filtro.label}`}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/70 inline-flex items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-3.5 text-sm transition-colors"
              >
                {filtro.label}
                <X className="size-3.5" />
              </Link>
            ))}

            {filtrosAplicados.length > 0 && (
              <Button variant="ghost" size="sm" render={<Link href={urlConModo('')} />}>
                Limpiar todo
              </Button>
            )}
          </div>

          {verIncompletas ? (
            partidos.length === 0 ? (
              <div className={margenResultados}>
                <EstadoVacio
                  titulo="No hay reservas incompletas"
                  texto="Cuando alguien deje un turno con lugar para sumarse, va a aparecer acá."
                />
              </div>
            ) : (
              <div className={`@container ${margenResultados}`}>
                <div className={`grid gap-5 ${clasesGrillaAdaptable(partidos.length)}`}>
                  {partidos.map((reserva) => (
                    <TarjetaPartidoAbierto key={reserva.id} reserva={reserva} />
                  ))}
                </div>
              </div>
            )
          ) : complejos.length === 0 ? (
            <div className={margenResultados}>
              <EstadoVacio
                titulo="No encontramos canchas con esos filtros"
                texto="Probá aflojando algún filtro."
              >
                <Button variant="secondary" render={<Link href="/jugador/canchas" />}>
                  Limpiar filtros
                </Button>
              </EstadoVacio>
            </div>
          ) : (
            <div className={`@container ${margenResultados}`}>
              <div className={`grid gap-5 ${clasesGrillaAdaptable(complejos.length)}`}>
                {complejos.map((complejo) => {
                  const deportes = deportesDistintos(complejo.canchas)
                  const precioMinimo = precioMasBajo(complejo.canchas)
                  let canchasConBloqueos = 0
                  for (const cancha of complejo.canchas) {
                    if (bloqueos.some((b) => b.courtId === cancha.id)) {
                      canchasConBloqueos++
                    }
                  }
                  let todasBloqueadas = true
                  for (const cancha of complejo.canchas) {
                    if (!cancha.bloqueadaTodoElDia) todasBloqueadas = false
                  }
                  let resumenBloqueos = resumenBloqueosParaElJugador(
                    canchasConBloqueos,
                    complejo.canchas.length,
                  )
                  if (todasBloqueadas) {
                    resumenBloqueos =
                      filtros.horaDesde || filtros.horaHasta
                        ? 'Bloqueado en ese horario'
                        : 'Bloqueado todo el día'
                  }

                  return (
                    <Link
                      key={complejo.id}
                      href={`/jugador/complejos/${complejo.id}${filtersToQueryString(filtros)}`}
                      className={`bg-card shadow-card hover:bg-accent flex h-full flex-col overflow-hidden rounded-2xl transition-colors ${todasBloqueadas ? 'opacity-60 grayscale' : ''}`}
                    >
                      {/* La foto de portada, con los deportes del complejo encima */}
                      <div className="relative aspect-16/10 shrink-0">
                        {complejo.imagenes.length > 0 ? (
                          <Image
                            src={complejo.imagenes[0].url}
                            alt={`Foto de ${complejo.nombre}`}
                            fill
                            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                            className="object-cover"
                          />
                        ) : (
                          <div className="bg-muted text-muted-foreground flex size-full flex-col items-center justify-center gap-1 text-sm">
                            <ImageIcon className="size-5" />
                            Sin fotos
                          </div>
                        )}
                        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
                          {deportes.map((deporteDeCancha) => (
                            <EtiquetaDeporte
                              key={deporteDeCancha}
                              deporte={deporteDeCancha}
                              sobreFoto
                            />
                          ))}
                        </div>
                      </div>

                      {/* flex-col + mt-auto en el pie: el precio queda a la misma
                          altura en toda la fila, aunque el nombre o la dirección
                          ocupen distinta cantidad de líneas entre tarjetas. */}
                      <div className="flex flex-1 flex-col p-5 pt-4">
                        <span className="font-heading block text-lg leading-snug font-bold">
                          {complejo.nombre}
                        </span>
                        <span className="text-muted-foreground mt-1 text-sm">
                          {complejo.direccion} · {complejo.zona}
                        </span>
                        <div className="mt-1.5">
                          <Estrellas
                            promedio={complejo.calificacion.promedio}
                            cantidad={complejo.calificacion.cantidad}
                          />
                        </div>
                        {resumenBloqueos && (
                          <div className="mt-1.5">
                            <AvisoBloqueo texto={resumenBloqueos} />
                          </div>
                        )}

                        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                          <div>
                            <p className="text-muted-foreground text-xs">desde</p>
                            <p className="font-heading text-primary text-2xl leading-tight font-bold">
                              {precioMinimo === null ? '—' : formatPrecio(precioMinimo)}
                            </p>
                          </div>
                          <span className="bg-muted rounded-full px-2.5 py-1 text-xs font-medium">
                            {complejo.canchas.length === 1
                              ? '1 cancha'
                              : `${complejo.canchas.length} canchas`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

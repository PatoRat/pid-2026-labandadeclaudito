'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { iniciales } from '@/lib/iniciales'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// A partir de cuántas letras empieza a sugerir (igual que el endpoint).
const MIN_CARACTERES = 3

type Jugador = { id: string; nombre: string; imagenUrl: string | null }

// Texto con hover en una reserva finalizada: al clickear abre un buscador para
// etiquetar amigos que tienen cuenta. Los etiquetados suman puntos. La búsqueda
// es por nombre de display (no por mail) y dispara a los 3 caracteres.
export function EtiquetarAmigos({
  bookingId,
  etiquetadosIniciales,
}: {
  bookingId: string
  etiquetadosIniciales: Jugador[]
}) {
  const router = useRouter()
  const [etiquetados, setEtiquetados] = useState<Jugador[]>(etiquetadosIniciales)
  const [query, setQuery] = useState('')
  const [sugerencias, setSugerencias] = useState<Jugador[]>([])
  const [buscando, setBuscando] = useState(false)
  const [error, setError] = useState('')

  // Búsqueda por cada caracter, con un respiro de 300 ms para no disparar una
  // consulta por tecla. Se cancela si el texto cambia antes de que vuelva. Con
  // menos de 3 letras no busca; la lista igual se oculta (ver ListaDeSugerencias).
  useEffect(() => {
    const texto = query.trim()
    if (texto.length < MIN_CARACTERES) return

    const id = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(texto)}`)
        const json = await res.json()
        setSugerencias(res.ok ? json.usuarios : [])
      } catch {
        setSugerencias([])
      }
      setBuscando(false)
    }, 300)

    return () => clearTimeout(id)
  }, [query])

  const yaEtiquetados = new Set(etiquetados.map((jugador) => jugador.id))
  const resultados = sugerencias.filter((jugador) => !yaEtiquetados.has(jugador.id))

  async function etiquetar(jugador: Jugador) {
    setError('')
    const res = await fetch(`/api/bookings/${bookingId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadorId: jugador.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      return
    }
    setEtiquetados((previos) => [...previos, jugador])
    setQuery('')
    setSugerencias([])
    // Refresca para que los puntos del amigo etiquetado queden al día
    router.refresh()
  }

  async function quitar(jugador: Jugador) {
    setError('')
    const res = await fetch(`/api/bookings/${bookingId}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadorId: jugador.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      return
    }
    setEtiquetados((previos) => previos.filter((otro) => otro.id !== jugador.id))
    router.refresh()
  }

  return (
    <div className="mt-1.5">
      <Popover>
        <PopoverTrigger className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-xs font-medium underline-offset-2 transition-colors hover:underline">
          <UserPlus className="size-3.5" />
          {etiquetados.length > 0
            ? `Jugaste con ${etiquetados.length} ${etiquetados.length === 1 ? 'amigo' : 'amigos'}`
            : '¿Jugaste con amigos? Etiquetalos y sumales puntos'}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <p className="font-medium">Etiquetá a los que jugaron</p>
          <p className="text-muted-foreground text-xs">
            Buscá por nombre y apellido. Cada amigo etiquetado suma puntos.
          </p>

          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre del jugador"
          />

          <ListaDeSugerencias
            query={query}
            buscando={buscando}
            resultados={resultados}
            onElegir={etiquetar}
          />

          {etiquetados.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
              {etiquetados.map((jugador) => (
                <span
                  key={jugador.id}
                  className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full py-1 pr-1 pl-2.5 text-xs font-medium"
                >
                  {jugador.nombre}
                  <button
                    type="button"
                    onClick={() => quitar(jugador)}
                    aria-label={`Quitar a ${jugador.nombre}`}
                    className="hover:bg-primary/20 flex size-4 items-center justify-center rounded-full"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && <p className="text-destructive text-xs font-medium">{error}</p>}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function ListaDeSugerencias({
  query,
  buscando,
  resultados,
  onElegir,
}: {
  query: string
  buscando: boolean
  resultados: Jugador[]
  onElegir: (jugador: Jugador) => void
}) {
  if (query.trim().length < MIN_CARACTERES) {
    return (
      <p className="text-muted-foreground text-xs">Escribí al menos {MIN_CARACTERES} letras.</p>
    )
  }
  if (buscando) {
    return <p className="text-muted-foreground text-xs">Buscando…</p>
  }
  if (resultados.length === 0) {
    return <p className="text-muted-foreground text-xs">No encontramos jugadores con ese nombre.</p>
  }

  return (
    <ul className="max-h-48 space-y-0.5 overflow-y-auto">
      {resultados.map((jugador) => (
        <li key={jugador.id}>
          <button
            type="button"
            onClick={() => onElegir(jugador)}
            className="hover:bg-muted flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left"
          >
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={jugador.imagenUrl ?? undefined} alt="" />
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                {iniciales(jugador.nombre)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium">{jugador.nombre}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

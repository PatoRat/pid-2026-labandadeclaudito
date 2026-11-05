'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { PUNTOS } from '@/lib/gamificacion'
import { createTicketSchema } from '@/lib/validations/ticket'
import { iniciales } from '@/lib/iniciales'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const MIN_CARACTERES = 3

type Jugador = { id: string; nombre: string; imagenUrl: string | null }

// El admin crea un ticket de penalización: elige un jugador (buscándolo por
// nombre), dice cuántas reservas invalida y por qué. La penalización en puntos
// es reservasInvalidas * PUNTOS.jugado (se muestra en vivo).
export function NuevoTicketDialog() {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)

  const [elegido, setElegido] = useState<Jugador | null>(null)
  const [query, setQuery] = useState('')
  const [sugerencias, setSugerencias] = useState<Jugador[]>([])
  const [reservasInvalidas, setReservasInvalidas] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const texto = query.trim()
    if (elegido || texto.length < MIN_CARACTERES) return
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(texto)}`)
        const json = await res.json()
        setSugerencias(res.ok ? json.usuarios : [])
      } catch {
        setSugerencias([])
      }
    }, 300)
    return () => clearTimeout(id)
  }, [query, elegido])

  function reiniciar() {
    setElegido(null)
    setQuery('')
    setSugerencias([])
    setReservasInvalidas('1')
    setMotivo('')
    setError('')
  }

  const cantidad = Number(reservasInvalidas)
  const penalizacion = Number.isFinite(cantidad) ? cantidad * PUNTOS.jugado : 0

  async function crear() {
    setError('')
    if (!elegido) {
      setError('Elegí un jugador.')
      return
    }
    const datos = { jugadorId: elegido.id, reservasInvalidas: cantidad, motivo: motivo.trim() }
    const parsed = createTicketSchema.safeParse(datos)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setGuardando(true)
    const res = await fetch('/api/admin/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
    const json = await res.json()
    setGuardando(false)
    if (!res.ok) {
      setError(json.error)
      return
    }
    setAbierto(false)
    reiniciar()
    router.refresh()
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(valor) => {
        setAbierto(valor)
        if (!valor) reiniciar()
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Nuevo ticket
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Penalizar a un jugador</DialogTitle>
          <DialogDescription>
            Generás un ticket: el jugador tiene 5 días para responder con evidencia.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jugador</Label>
            {elegido ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-border p-2">
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={elegido.imagenUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                    {iniciales(elegido.nombre)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {elegido.nombre}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setElegido(null)}>
                  Cambiar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscá por nombre y apellido"
                />
                {query.trim().length >= MIN_CARACTERES && sugerencias.length > 0 && (
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1">
                    {sugerencias.map((jugador) => (
                      <li key={jugador.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setElegido(jugador)
                            setQuery('')
                          }}
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
                )}
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reservasInvalidas">Reservas a invalidar</Label>
            <Input
              id="reservasInvalidas"
              type="number"
              min={1}
              value={reservasInvalidas}
              onChange={(e) => setReservasInvalidas(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Se le descontarán {penalizacion} puntos ({PUNTOS.jugado} por reserva).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea
              id="motivo"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué invalidás esas reservas"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm font-medium">
              {error}
            </div>
          )}

          <Button className="w-full" onClick={crear} disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear ticket'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

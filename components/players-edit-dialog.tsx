'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
import type { Deporte } from '@/lib/generated/prisma/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { maxJugadoresPorDeporte, textoJugadoresFaltantes } from '@/lib/jugadores'

// Editar los jugadores de una reserva ya hecha: marcarla completa o cargar
// cuántos hay. La seña no cambia.
export function PlayersEditDialog({
  bookingId,
  deporte,
  jugadores,
  className,
}: {
  bookingId: string
  deporte: Deporte
  jugadores: number | null
  className?: string
}) {
  const router = useRouter()
  const maxJugadores = maxJugadoresPorDeporte[deporte]

  const [abierto, setAbierto] = useState(false)
  const [completa, setCompleta] = useState(jugadores === null)
  const [cantidadJugadores, setCantidadJugadores] = useState(jugadores ?? 1)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setError('')
    setGuardando(true)

    const res = await fetch(`/api/bookings/${bookingId}/players`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadores: completa ? null : cantidadJugadores }),
    })
    const json = await res.json()

    setGuardando(false)
    if (!res.ok) {
      setError(json.error)
      return
    }
    setAbierto(false)
    router.refresh()
  }

  return (
    <AlertDialog open={abierto} onOpenChange={setAbierto}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className={className}>
            <Users className="size-3.5" />
            Jugadores
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Jugadores de la reserva</AlertDialogTitle>
          <AlertDialogDescription>
            Deci si el equipo está completo o cuántos jugadores hay. La seña no cambia.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
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
                value={cantidadJugadores}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (Number.isNaN(n)) return
                  // Nunca negativo ni más que el máximo del deporte.
                  if (n < 1) setCantidadJugadores(1)
                  else if (n > maxJugadores) setCantidadJugadores(maxJugadores)
                  else setCantidadJugadores(n)
                }}
              />
              <p className="text-muted-foreground text-sm">
                {textoJugadoresFaltantes(deporte, cantidadJugadores) ??
                  `Con ${maxJugadores} jugadores queda completa.`}
              </p>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

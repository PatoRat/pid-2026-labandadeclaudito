'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'
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
import { textoJugadoresFaltantes } from '@/lib/jugadores'

// Editar los jugadores de una reserva ya hecha: marcarla completa o cargar
// cuántos hay. La seña no cambia.
export function PlayersEditDialog({
  bookingId,
  capacidad,
  jugadores,
  className,
}: {
  bookingId: string
  // Máximo de jugadores de la cancha (Cancha.capacidad)
  capacidad: number
  jugadores: number | null
  className?: string
}) {
  const router = useRouter()
  const maxJugadores = capacidad

  const [abierto, setAbierto] = useState(false)
  const [completa, setCompleta] = useState(jugadores === null)
  // String para poder borrar y escribir libre; se acota al salir del campo.
  const [cantidadTexto, setCantidadTexto] = useState(String(jugadores ?? 1))
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Normaliza el texto a un entero válido (1..máximo). El server re-normaliza.
  function cantidadParaMandar() {
    const n = parseInt(cantidadTexto, 10)
    if (Number.isNaN(n) || n < 1) return 1
    if (n > maxJugadores) return maxJugadores
    return n
  }

  async function guardar() {
    setError('')
    setGuardando(true)

    const res = await fetch(`/api/bookings/${bookingId}/players`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadores: completa ? null : cantidadParaMandar() }),
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
                value={cantidadTexto}
                // Se escribe libre; se acota a 1..máximo al salir del campo
                onChange={(e) => setCantidadTexto(e.target.value)}
                onBlur={() => setCantidadTexto(String(cantidadParaMandar()))}
              />
              <p className="text-muted-foreground text-sm">
                {textoJugadoresFaltantes(capacidad, cantidadParaMandar()) ??
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

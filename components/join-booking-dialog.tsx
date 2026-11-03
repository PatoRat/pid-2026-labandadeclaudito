'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
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
import { jugadoresFaltantes, textoCupo } from '@/lib/jugadores'

// Sumarse a una reserva incompleta de otro, desde una tarjeta (feed o búsqueda).
// Se elige cuántos jugadores se aportan (como en el selector de turnos).
export function JoinBookingDialog({
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
  const faltan = jugadoresFaltantes(capacidad, jugadores)

  const [abierto, setAbierto] = useState(false)
  // String para poder borrar y escribir libre; se acota al salir del campo.
  const [cantidadTexto, setCantidadTexto] = useState('1')
  const [error, setError] = useState('')
  const [sumando, setSumando] = useState(false)

  // Acota lo pedido a [1, lo que falta]. El server igual lo re-chequea.
  function cantidadParaMandar() {
    const n = parseInt(cantidadTexto, 10)
    if (Number.isNaN(n) || n < 1) return 1
    if (n > faltan) return faltan
    return n
  }

  async function sumarse() {
    setError('')
    setSumando(true)

    const res = await fetch(`/api/bookings/${bookingId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jugadores: cantidadParaMandar() }),
    })
    const json = await res.json()

    setSumando(false)
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
          <Button size="sm" className={className}>
            <UserPlus className="size-3.5" />
            Sumarte
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sumarte a este partido</AlertDialogTitle>
          <AlertDialogDescription>
            Elegí cuántos jugadores aportás. No pagás seña: ese turno ya tiene la seña del que lo
            reservó.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cantidadParaSumarse">Cuántos se suman</Label>
          <Input
            id="cantidadParaSumarse"
            type="number"
            min={1}
            max={faltan}
            value={cantidadTexto}
            onChange={(e) => setCantidadTexto(e.target.value)}
            onBlur={() => setCantidadTexto(String(cantidadParaMandar()))}
          />
          <p className="text-muted-foreground text-sm">
            Faltan {faltan} para completar ({textoCupo(capacidad, jugadores)}).
          </p>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={sumarse} disabled={sumando}>
            {sumando ? 'Sumándote...' : 'Sumarte'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

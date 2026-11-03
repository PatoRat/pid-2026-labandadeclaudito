'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

// Para el jugador que se sumó a la reserva de otro: en vez de cancelarla (no es
// suya), se sale y su lugar vuelve a quedar libre para que otro se sume.
export function LeaveBookingButton({
  bookingId,
  className,
}: {
  bookingId: string
  className?: string
}) {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)
  const [error, setError] = useState('')

  async function salirse() {
    setError('')
    setSaliendo(true)

    const res = await fetch(`/api/bookings/${bookingId}/join`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setSaliendo(false)
      return
    }

    router.refresh()
    setSaliendo(false)
  }

  return (
    <div className={className}>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="destructive" size="sm" className="w-full" />}>
          Salirse de la reserva
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salirte de esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu lugar vuelve a quedar libre para que otro jugador se sume. Si después querés
              volver, vas a tener que sumarte de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={salirse} disabled={saliendo}>
              {saliendo ? 'Saliendo...' : 'Sí, salirme'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-destructive mt-1 text-xs">{error}</p>}
    </div>
  )
}

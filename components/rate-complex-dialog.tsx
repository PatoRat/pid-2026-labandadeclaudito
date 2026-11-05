'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Estrella } from '@/components/estrella'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { MAX_CARACTERES_COMENTARIO, rateComplexSchema } from '@/lib/validations/rating'

const POSICIONES = [1, 2, 3, 4, 5]
const TEXTO_DEL_PUNTAJE = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente']

export function RateComplexDialog({
  bookingId,
  nombreComplejo,
}: {
  bookingId: string
  nombreComplejo: string
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [puntaje, setPuntaje] = useState(0)
  // La estrella sobre la que está el mouse: muestra cómo quedaría antes de elegir
  const [puntajeBajoElMouse, setPuntajeBajoElMouse] = useState(0)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const puntajeQueSeVe = puntajeBajoElMouse > 0 ? puntajeBajoElMouse : puntaje

  async function enviar() {
    setError('')

    const parsed = rateComplexSchema.safeParse({ puntaje, comentario })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    setEnviando(true)
    const res = await fetch(`/api/bookings/${bookingId}/rating`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setEnviando(false)
      return
    }

    setAbierto(false)
    setEnviando(false)
    router.refresh()
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Star className="size-4" />
        Calificar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cómo estuvo {nombreComplejo}?</DialogTitle>
          <DialogDescription>
            Tu calificación ayuda a otros jugadores a elegir dónde jugar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1" onMouseLeave={() => setPuntajeBajoElMouse(0)}>
              {POSICIONES.map((posicion) => (
                <button
                  key={posicion}
                  type="button"
                  onClick={() => setPuntaje(posicion)}
                  onMouseEnter={() => setPuntajeBajoElMouse(posicion)}
                  aria-label={posicion === 1 ? '1 estrella' : `${posicion} estrellas`}
                  aria-pressed={puntaje === posicion}
                  className={cn(
                    'focus-visible:ring-ring/50 rounded-lg p-1 transition-transform duration-150 outline-none hover:scale-115 focus-visible:ring-3 active:scale-90',
                    // La elegida queda un poco más grande: se nota cuál tocaste
                    posicion === puntaje && 'scale-110',
                  )}
                >
                  <Estrella relleno={posicion <= puntajeQueSeVe ? 1 : 0} tamanio="size-10" />
                </button>
              ))}
            </div>
            {puntajeQueSeVe > 0 ? (
              <p className="bg-highlight text-highlight-foreground rounded-full px-3 py-0.5 text-sm font-bold">
                {TEXTO_DEL_PUNTAJE[puntajeQueSeVe]}
              </p>
            ) : (
              <p className="text-muted-foreground py-0.5 text-sm font-medium">Tocá una estrella</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`comentario-${bookingId}`}>Contanos algo más (opcional)</Label>
            <Textarea
              id={`comentario-${bookingId}`}
              rows={3}
              maxLength={MAX_CARACTERES_COMENTARIO}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="El estado de la cancha, los vestuarios, la atención..."
            />
            <p className="text-muted-foreground text-right text-xs">
              {comentario.length}/{MAX_CARACTERES_COMENTARIO}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAbierto(false)}>
            Volver
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            {enviando ? 'Enviando...' : 'Enviar calificación'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

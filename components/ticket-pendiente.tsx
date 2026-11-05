'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// Un ticket de penalización que el jugador tiene que responder (o apelar) desde
// su inicio. Tiene 5 días: mientras no venzan, mantiene sus puntos; después la
// penalización ya se aplicó pero todavía puede mandar evidencia para apelar.
// Al subir evidencia se refresca y el admin la ve en su inicio.
export function TicketPendiente({
  ticketId,
  motivo,
  reservasInvalidas,
  penalizacion,
  puntosAnteriores,
  venceEn,
  yaRespondio,
}: {
  ticketId: string
  motivo: string
  reservasInvalidas: number
  penalizacion: number
  puntosAnteriores: number
  venceEn: string
  yaRespondio: boolean
}) {
  const router = useRouter()
  const [comentario, setComentario] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  // El tiempo restante se calcula en el navegador para no mostrar en el server
  // una cuenta distinta a la del cliente. null hasta que monta.
  const [vencido, setVencido] = useState<boolean | null>(null)
  const [diasRestantes, setDiasRestantes] = useState(0)
  useEffect(() => {
    function actualizar() {
      const ms = new Date(venceEn).getTime() - Date.now()
      setVencido(ms <= 0)
      setDiasRestantes(Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000))))
    }
    actualizar()
    const id = setInterval(actualizar, 60 * 1000)
    return () => clearInterval(id)
  }, [venceEn])

  async function responder() {
    setError('')
    if (!archivo) {
      setError('Adjuntá una imagen que pruebe tu asistencia.')
      return
    }
    setEnviando(true)

    const formData = new FormData()
    formData.append('archivo', archivo)
    if (comentario.trim() !== '') formData.append('comentario', comentario.trim())

    const res = await fetch(`/api/tickets/${ticketId}/evidence`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    setEnviando(false)

    if (!res.ok) {
      setError(json.error)
      return
    }
    setArchivo(null)
    setComentario('')
    router.refresh()
  }

  return (
    <section className="bg-card shadow-card overflow-hidden rounded-3xl">
      <div className="bg-destructive/8 flex items-start gap-4 p-6">
        <span className="bg-destructive/10 text-destructive flex size-11 shrink-0 items-center justify-center rounded-xl">
          <ShieldAlert className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-destructive text-sm font-semibold">Revisión de tus puntos</p>
          <h2 className="font-heading text-xl font-bold">
            El admin quiere descontarte {penalizacion} puntos
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Marcó {reservasInvalidas} {reservasInvalidas === 1 ? 'reserva' : 'reservas'} como no
            válida{reservasInvalidas === 1 ? '' : 's'}. Tenías {puntosAnteriores} puntos.
          </p>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <p className="text-sm font-semibold">Motivo</p>
          <p className="text-muted-foreground mt-1 text-sm whitespace-pre-line">{motivo}</p>
        </div>

        {/* El estado del plazo: a tiempo mantiene los puntos; vencido ya se
            aplicó la penalización pero todavía puede apelar. */}
        {vencido === null ? null : vencido ? (
          <p className="text-destructive text-sm font-medium">
            Se venció el plazo: el descuento ya se aplicó. Todavía podés apelar con tu evidencia.
          </p>
        ) : (
          <p className="text-sm font-medium">
            Te {diasRestantes === 1 ? 'queda' : 'quedan'} {diasRestantes}{' '}
            {diasRestantes === 1 ? 'día' : 'días'} para responder. Hasta entonces mantenés tus
            puntos.
          </p>
        )}

        {yaRespondio && (
          <p className="text-muted-foreground text-sm">
            Ya enviaste evidencia. El admin la va a revisar y decidir. Podés sumar más abajo.
          </p>
        )}

        <div className="border-border space-y-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={`evidencia-${ticketId}`}>Tu evidencia (una imagen)</Label>
            <Input
              id={`evidencia-${ticketId}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`comentario-${ticketId}`}>Comentario (opcional)</Label>
            <Textarea
              id={`comentario-${ticketId}`}
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Contá por qué sí jugaste esos partidos"
            />
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm font-medium">
              {error}
            </div>
          )}

          <Button onClick={responder} disabled={enviando}>
            {enviando ? 'Enviando…' : yaRespondio ? 'Enviar otra prueba' : 'Enviar evidencia'}
          </Button>
        </div>
      </div>
    </section>
  )
}

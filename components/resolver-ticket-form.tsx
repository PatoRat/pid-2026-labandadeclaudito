'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { resolveTicketSchema } from '@/lib/validations/ticket'

type Decision = 'VALIDAR' | 'RECHAZAR'

const decisiones: Decision[] = ['VALIDAR', 'RECHAZAR']

const titulo: Record<Decision, string> = {
  VALIDAR: 'Validar la evidencia',
  RECHAZAR: 'Rechazar la evidencia',
}

const queCambia: Record<Decision, string> = {
  VALIDAR: 'La penalización se anula: el jugador mantiene sus puntos.',
  RECHAZAR: 'La penalización queda firme: el jugador pierde los puntos.',
}

function leerDecision(valor: unknown): Decision | '' {
  if (valor === 'VALIDAR' || valor === 'RECHAZAR') return valor
  return ''
}

export function ResolverTicketForm({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const [decision, setDecision] = useState<Decision | ''>('')
  const [comentarioAdmin, setComentarioAdmin] = useState('')
  const [errorDeDecision, setErrorDeDecision] = useState('')
  const [errorDeComentario, setErrorDeComentario] = useState('')
  const [error, setError] = useState('')
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  function revisar() {
    setError('')
    setErrorDeDecision('')
    setErrorDeComentario('')

    if (decision === '') {
      setErrorDeDecision('Elegí si validás o rechazás la evidencia.')
      return
    }

    const parsed = resolveTicketSchema.safeParse({ decision, comentarioAdmin })
    if (!parsed.success) {
      setErrorDeComentario(parsed.error.issues[0].message)
      return
    }

    setConfirmando(true)
  }

  async function resolver() {
    setGuardando(true)

    const res = await fetch(`/api/admin/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comentarioAdmin: comentarioAdmin.trim() }),
    })
    const json = await res.json()

    setGuardando(false)
    setConfirmando(false)

    if (!res.ok) {
      setError(json.error)
      return
    }

    router.refresh()
  }

  return (
    <div className="bg-card shadow-card rounded-3xl p-6">
      <h2 className="font-heading text-xl font-bold">Resolver el ticket</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Lo que decidas es definitivo: el ticket queda cerrado con tu explicación.
      </p>

      <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <Label>¿Qué hacés con la evidencia?</Label>
          <RadioGroup
            value={decision}
            onValueChange={(valor) => setDecision(leerDecision(valor))}
            aria-invalid={!!errorDeDecision}
          >
            {decisiones.map((opcion) => (
              <label
                key={opcion}
                className="hover:bg-muted flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5"
              >
                <RadioGroupItem value={opcion} className="mt-1" />
                <span className="text-sm">
                  <span className="font-medium">{titulo[opcion]}</span>
                  <span className="text-muted-foreground block text-xs">{queCambia[opcion]}</span>
                </span>
              </label>
            ))}
          </RadioGroup>
          {errorDeDecision && (
            <p className="text-destructive flex items-center gap-1 text-xs font-medium">
              <AlertCircle className="size-3.5" />
              {errorDeDecision}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="comentarioAdmin">Por qué</Label>
          <p className="text-muted-foreground text-sm">Esto lo lee el jugador.</p>
          <Textarea
            id="comentarioAdmin"
            rows={4}
            value={comentarioAdmin}
            onChange={(e) => setComentarioAdmin(e.target.value)}
            placeholder="Explicá en qué te basaste para decidir"
            aria-invalid={!!errorDeComentario}
          />
          {errorDeComentario && (
            <p className="text-destructive flex items-center gap-1 text-xs font-medium">
              <AlertCircle className="size-3.5" />
              {errorDeComentario}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm font-medium">
            {error}
          </div>
        )}

        <Button size="lg" className="w-full" onClick={revisar} disabled={guardando}>
          Guardar la resolución
        </Button>
      </div>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resolver el ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              {decision === '' ? '' : `${queCambia[decision]} `}
              El ticket queda cerrado con tu explicación y no se puede volver a editar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={resolver} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Sí, resolver'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

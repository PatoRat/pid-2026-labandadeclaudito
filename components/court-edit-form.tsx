'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DeleteCourtDialog } from '@/components/delete-court-dialog'
import { MinAdvanceInput } from '@/components/min-advance-input'
import { TimeSelect } from '@/components/time-select'
import { VistaPreviaCancha } from '@/components/vista-previa-cancha'
import { timeTextToMinutes } from '@/lib/time'
import { updateCourtSchema } from '@/lib/validations/court'
import { deporteLabels, superficieLabels, superficiesPorDeporte } from '@/lib/labels'
import { capacidadPorDeporte } from '@/lib/jugadores'
import type { Cancha } from '@/lib/generated/prisma/client'

type CanchaConPrecioString = Omit<Cancha, 'precioBase'> & { precioBase: string }

export function CourtEditForm({
  complejoId,
  cancha,
}: {
  complejoId: string
  cancha: CanchaConPrecioString
}) {
  const router = useRouter()
  const [deporte, setDeporte] = useState(cancha.deporte)
  const [tipoSuperficie, setTipoSuperficie] = useState(cancha.tipoSuperficie)
  const [horaApertura, setHoraApertura] = useState(cancha.horaApertura)
  const [horaCierre, setHoraCierre] = useState(cancha.horaCierre)
  // String para poder borrar y escribir libre
  const [capacidad, setCapacidad] = useState(String(cancha.capacidad))
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)
  const [aviso, setAviso] = useState('')

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    const form = new FormData(e.currentTarget)
    const porcentajeSenaTexto = form.get('porcentajeSena') as string
    const datos = {
      nombre: form.get('nombre'),
      deporte,
      tipoSuperficie,
      precioBase: form.get('precioBase'),
      horaApertura,
      horaCierre,
      duracionTurnoMin: form.get('duracionTurnoMin'),
      capacidad,
      // Campo vacío = usar el % de seña por defecto del complejo, no uno propio
      porcentajeSena: porcentajeSenaTexto === '' ? null : Number(porcentajeSenaTexto),
      // Campo vacío = usar la anticipación mínima por defecto del complejo
      minAdvanceMinutes: timeTextToMinutes(form.get('minAdvance') as string),
    }

    const parsed = updateCourtSchema.safeParse(datos)
    if (!parsed.success) {
      const errores = parsed.error.flatten().fieldErrors
      setFieldErrors(
        Object.fromEntries(
          Object.entries(errores).map(([campo, mensajes]) => [campo, mensajes?.[0] ?? '']),
        ),
      )
      return
    }

    setCargando(true)
    const res = await fetch(`/api/courts/${cancha.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setCargando(false)
      return
    }

    // Si el horario nuevo dejó afuera precios o bloqueos, la API los eliminó:
    // se avisa antes de volver al listado.
    const partes: string[] = []
    if (json.preciosEliminados > 0) {
      partes.push(
        json.preciosEliminados === 1
          ? '1 precio especial'
          : `${json.preciosEliminados} precios especiales`,
      )
    }
    if (json.bloqueosEliminados > 0) {
      partes.push(
        json.bloqueosEliminados === 1 ? '1 bloqueo' : `${json.bloqueosEliminados} bloqueos`,
      )
    }
    if (partes.length === 0) {
      router.push(`/dueno/complejos/${complejoId}/canchas`)
      return
    }
    setAviso(
      `Cambios guardados. Con el horario nuevo se eliminaron ${partes.join(' y ')} que quedaban fuera del horario.`,
    )
    setCargando(false)
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="bg-card shadow-card grid grid-cols-1 gap-4 rounded-3xl p-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre identificador</Label>
              <Input
                id="nombre"
                name="nombre"
                defaultValue={cancha.nombre}
                aria-invalid={!!fieldErrors.nombre}
                className={
                  fieldErrors.nombre ? 'border-destructive ring-destructive/20 ring-3' : undefined
                }
              />
              {fieldErrors.nombre && (
                <p className="text-destructive flex items-center gap-1 text-xs font-medium">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.nombre}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Deporte</Label>
              <Select
                value={deporte}
                onValueChange={(v) => {
                  const nuevoDeporte = v as typeof deporte
                  setDeporte(nuevoDeporte)
                  setCapacidad(String(capacidadPorDeporte[nuevoDeporte]))
                  // Si la superficie elegida no tiene sentido para el nuevo deporte,
                  // se pasa a la primera que sí (ej: fútbol nunca en polvo de ladrillo)
                  if (!superficiesPorDeporte[nuevoDeporte].includes(tipoSuperficie)) {
                    setTipoSuperficie(superficiesPorDeporte[nuevoDeporte][0])
                  }
                }}
              >
                <SelectTrigger className="w-full" aria-label="Deporte">
                  <SelectValue>{(v: typeof deporte) => deporteLabels[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(deporteLabels).map(([valor, label]) => (
                    <SelectItem key={valor} value={valor}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Superficie</Label>
              <Select
                key={deporte}
                value={tipoSuperficie}
                onValueChange={(v) => setTipoSuperficie(v as typeof tipoSuperficie)}
              >
                <SelectTrigger className="w-full" aria-label="Superficie">
                  <SelectValue>{(v: typeof tipoSuperficie) => superficieLabels[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {superficiesPorDeporte[deporte].map((valor) => (
                    <SelectItem key={valor} value={valor}>
                      {superficieLabels[valor]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="precioBase"
                className={fieldErrors.precioBase ? 'text-destructive font-semibold' : undefined}
              >
                Precio base por turno ($ ARS) {fieldErrors.precioBase && '*'}
              </Label>
              <Input
                id="precioBase"
                name="precioBase"
                type="number"
                step="0.01"
                defaultValue={cancha.precioBase}
                aria-invalid={!!fieldErrors.precioBase}
                className={
                  fieldErrors.precioBase
                    ? 'border-destructive ring-destructive/20 ring-3'
                    : undefined
                }
              />
              {fieldErrors.precioBase && (
                <p className="text-destructive flex items-center gap-1 text-xs font-medium">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.precioBase}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="capacidad"
                className={fieldErrors.capacidad ? 'text-destructive font-semibold' : undefined}
              >
                Capacidad (jugadores) {fieldErrors.capacidad && '*'}
              </Label>
              <Input
                id="capacidad"
                type="number"
                min={2}
                max={30}
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                aria-invalid={!!fieldErrors.capacidad}
                className={
                  fieldErrors.capacidad
                    ? 'border-destructive ring-destructive/20 ring-3'
                    : undefined
                }
              />
              {fieldErrors.capacidad && (
                <p className="text-destructive flex items-center gap-1 text-xs font-medium">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.capacidad}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Apertura</Label>
              <TimeSelect label="Apertura" value={horaApertura} onChange={setHoraApertura} />
            </div>

            <div className="space-y-2">
              <Label>Cierre</Label>
              <TimeSelect label="Cierre" value={horaCierre} onChange={setHoraCierre} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duracionTurnoMin">Duración de turno (min)</Label>
              <Input
                id="duracionTurnoMin"
                name="duracionTurnoMin"
                type="number"
                min={30}
                max={180}
                defaultValue={cancha.duracionTurnoMin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="porcentajeSena">Seña propia (%)</Label>
              <Input
                id="porcentajeSena"
                name="porcentajeSena"
                type="number"
                min={0}
                max={100}
                placeholder="Usa el % del complejo"
                defaultValue={cancha.porcentajeSena ?? ''}
                aria-invalid={!!fieldErrors.porcentajeSena}
                className={
                  fieldErrors.porcentajeSena
                    ? 'border-destructive ring-destructive/20 ring-3'
                    : undefined
                }
              />
              <p className="text-muted-foreground text-xs">
                Vacío = usa el % de seña por defecto del complejo.
              </p>
              {fieldErrors.porcentajeSena && (
                <p className="text-destructive flex items-center gap-1 text-xs font-medium">
                  <AlertCircle className="size-3.5" />
                  {fieldErrors.porcentajeSena}
                </p>
              )}
            </div>

            <MinAdvanceInput
              name="minAdvance"
              label="Anticipación mínima propia"
              defaultMinutes={cancha.minAdvanceMinutes}
              help="Vacío = usa la anticipación mínima por defecto del complejo."
              error={fieldErrors.minAdvanceMinutes}
              allowEmpty
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              render={<a href={`/dueno/complejos/${complejoId}/canchas`} />}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={cargando}>
              {cargando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {cargando ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}
          {aviso && (
            <div role="status" className="bg-muted space-y-3 rounded-xl p-4 text-sm">
              <p>{aviso}</p>
              <Button
                type="button"
                size="sm"
                render={<a href={`/dueno/complejos/${complejoId}/canchas`} />}
              >
                Volver a canchas
              </Button>
            </div>
          )}
        </form>

        <div className="bg-destructive/8 flex flex-wrap items-center justify-between gap-4 rounded-3xl p-6">
          <div>
            <p className="text-destructive font-semibold">Eliminar esta cancha</p>
            <p className="text-foreground/80 mt-1 text-sm">
              Se elimina solo “{cancha.nombre}”, sin afectar a las demás.
            </p>
          </div>
          <DeleteCourtDialog
            courtId={cancha.id}
            courtName={cancha.nombre}
            onDeleted={() => router.push(`/dueno/complejos/${complejoId}/canchas`)}
          />
        </div>
      </div>

      <aside className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
        <VistaPreviaCancha
          nombre={cancha.nombre}
          deporte={deporte}
          tipoSuperficie={tipoSuperficie}
          horaApertura={horaApertura}
          horaCierre={horaCierre}
        />
      </aside>
    </div>
  )
}

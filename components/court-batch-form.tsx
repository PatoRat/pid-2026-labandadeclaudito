'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleCheck, Loader2, Save } from 'lucide-react'
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
import { TimeSelect } from '@/components/time-select'
import { VistaPreviaCancha } from '@/components/vista-previa-cancha'
import type { Deporte, TipoSuperficie } from '@/lib/generated/prisma/client'
import { createCourtSchema } from '@/lib/validations/court'
import { deporteLabels, superficieLabels, superficiesPorDeporte } from '@/lib/labels'
import { capacidadPorDeporte } from '@/lib/jugadores'
import { generateSlots } from '@/lib/time'

const duracionOpciones: Record<string, string> = {
  '30': '30 minutos',
  '45': '45 minutos',
  '60': '60 minutos (estándar)',
  '90': '90 minutos',
  '120': '120 minutos',
}

export function CourtBatchForm({ complejoId }: { complejoId: string }) {
  const router = useRouter()
  const [deporte, setDeporte] = useState<Deporte>('FUTBOL_5')
  const [tipoSuperficie, setTipoSuperficie] = useState<TipoSuperficie>('CESPED_SINTETICO')
  const [cantidad, setCantidad] = useState(1)
  const [horaApertura, setHoraApertura] = useState('08:00')
  const [horaCierre, setHoraCierre] = useState('23:00')
  const [duracionTurnoMin, setDuracionTurnoMin] = useState('60')
  // String para poder borrar y escribir libre; se precarga según el deporte
  const [capacidad, setCapacidad] = useState(String(capacidadPorDeporte.FUTBOL_5))
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Mismo cálculo que hace el server al generar los turnos reales (lib/time.ts,
  // generateSlots): así la vista previa nunca queda desincronizada de lo que
  // en verdad se va a poder reservar.
  const turnosPorCancha = generateSlots(horaApertura, horaCierre, Number(duracionTurnoMin)).length

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const form = new FormData(e.currentTarget)
    const datos = {
      nombrePrefijo: form.get('nombrePrefijo'),
      cantidad: form.get('cantidad'),
      deporte,
      tipoSuperficie,
      precioBase: form.get('precioBase'),
      horaApertura,
      horaCierre,
      duracionTurnoMin,
      capacidad,
    }

    const parsed = createCourtSchema.safeParse(datos)
    if (!parsed.success) {
      setError('Revisá los datos, algo no es válido')
      return
    }

    setCargando(true)
    const res = await fetch(`/api/complexes/${complejoId}/courts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
    if (res.ok) {
      router.push(`/dueno/complejos/${complejoId}/canchas`)
      return
    }
    const json = await res.json()
    setError(json.error)
    setCargando(false)
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="bg-card shadow-card rounded-3xl p-6">
          <h2 className="font-heading mb-4 text-xl font-bold">Datos de la cancha</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <Label htmlFor="nombrePrefijo">Nombre</Label>
              <Input
                id="nombrePrefijo"
                name="nombrePrefijo"
                placeholder="Cancha"
                defaultValue="Cancha"
              />
              <p className="text-muted-foreground text-sm">
                Con “Cancha” quedan “Cancha 1”, “Cancha 2”…
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cantidad">¿Cuántas canchas iguales?</Label>
              <Input
                id="cantidad"
                name="cantidad"
                type="number"
                min={1}
                max={20}
                value={cantidad}
                onChange={(e) => setCantidad(Number(e.target.value))}
              />
              <p className="text-muted-foreground text-sm">
                Cada una queda como una cancha aparte.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="precioBase">Precio base por turno ($ ARS)</Label>
              <Input
                id="precioBase"
                name="precioBase"
                type="number"
                step="0.01"
                placeholder="24000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidad">Capacidad (jugadores)</Label>
              <Input
                id="capacidad"
                type="number"
                min={2}
                max={30}
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
              />
              <p className="text-muted-foreground text-sm">
                Hasta cuántos pueden jugar, sumando los dos equipos.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card shadow-card rounded-3xl p-6">
          <h2 className="font-heading mb-4 text-xl font-bold">Horarios disponibles</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Apertura</Label>
              <TimeSelect label="Apertura" value={horaApertura} onChange={setHoraApertura} />
            </div>

            <div className="space-y-2">
              <Label>Cierre</Label>
              <TimeSelect label="Cierre" value={horaCierre} onChange={setHoraCierre} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="duracionTurnoMin">Duración de turno</Label>
              <Select value={duracionTurnoMin} onValueChange={(v) => v && setDuracionTurnoMin(v)}>
                <SelectTrigger className="w-full" aria-label="Duración de turno">
                  <SelectValue>{(v: string) => duracionOpciones[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(duracionOpciones).map(([valor, label]) => (
                    <SelectItem key={valor} value={valor}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-primary/10 mt-4 flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm">
            <CircleCheck className="text-primary size-4 shrink-0" />
            <span>
              Se darán de alta{' '}
              <strong>
                {cantidad} {cantidad === 1 ? 'cancha individual' : 'canchas individuales'}
              </strong>{' '}
              con {turnosPorCancha} turnos de {duracionTurnoMin} min cada una.
            </span>
          </div>
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
            {cargando ? 'Guardando...' : 'Guardar canchas'}
          </Button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>

      <aside className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
        {/* El nombre usa "Cancha" fijo: el prefijo es un input no controlado */}
        <VistaPreviaCancha
          nombre={cantidad > 1 ? `Cancha 1 a ${cantidad}` : 'Cancha 1'}
          deporte={deporte}
          tipoSuperficie={tipoSuperficie}
          horaApertura={horaApertura}
          horaCierre={horaCierre}
          detalle={`${turnosPorCancha} turnos de ${duracionTurnoMin} min por cancha.`}
        />
      </aside>
    </div>
  )
}

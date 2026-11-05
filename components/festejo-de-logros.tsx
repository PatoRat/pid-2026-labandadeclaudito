'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Award, Trophy } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NIVELES } from '@/lib/gamificacion'

type Logros = {
  nivel: string
  insignias: string[]
}

type InsigniaGanada = {
  id: string
  nombre: string
}

// Lo que se festeja: el nivel nuevo (null si no subió) y las insignias nuevas
type Festejo = {
  nivelNuevo: string | null
  insigniasNuevas: InsigniaGanada[]
}

// Colores del papel picado: los de la paleta (sin hex escritos a mano)
const COLORES_CONFETI = ['bg-highlight', 'bg-primary', 'bg-clay', 'bg-sidebar']
const CANTIDAD_CONFETI = 48

// Festeja cuando el jugador sube de nivel o gana una insignia. Lo que ya vio
// se guarda en el navegador (localStorage): si al entrar tiene algo nuevo
// respecto de eso, se muestra el festejo una vez.
// La primera vez que entra no hay nada guardado: se comparan sus logros contra
// "Suplente sin insignias", así festeja lo que ya tenía.
export function FestejoDeLogros({
  usuarioId,
  nivel,
  insignias,
}: {
  usuarioId: string
  nivel: string
  insignias: InsigniaGanada[]
}) {
  // null = no hay nada para festejar (el festejo está cerrado)
  const [festejo, setFestejo] = useState<Festejo | null>(null)

  const clave = `tocayjuga-logros-${usuarioId}`

  // Va en un efecto porque localStorage solo existe en el navegador
  useEffect(() => {
    let vistos: Logros = { nivel: 'Suplente', insignias: [] }
    try {
      const guardado = localStorage.getItem(clave)
      if (guardado) vistos = JSON.parse(guardado)
    } catch {
      // Sin acceso al almacenamiento (modo privado): no se festeja nada
      return
    }

    const posicionVista = NIVELES.findIndex((n) => n.nombre === vistos.nivel)
    const posicionActual = NIVELES.findIndex((n) => n.nombre === nivel)
    const subioDeNivel = posicionActual > posicionVista

    const nuevas: InsigniaGanada[] = []
    for (const insignia of insignias) {
      if (!vistos.insignias.includes(insignia.id)) nuevas.push(insignia)
    }

    if (subioDeNivel || nuevas.length > 0) {
      // localStorage solo se puede leer después de montar (en el server no
      // existe), así que el estado se carga acá y no al declararlo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFestejo({ nivelNuevo: subioDeNivel ? nivel : null, insigniasNuevas: nuevas })
    } else {
      // Nada nuevo (o bajó de nivel): se guarda igual, para comparar la próxima
      guardarVistos()
    }
    // Solo al entrar a la pantalla: no hace falta volver a mirar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function guardarVistos() {
    const actuales: Logros = { nivel, insignias: insignias.map((insignia) => insignia.id) }
    try {
      localStorage.setItem(clave, JSON.stringify(actuales))
    } catch {
      // Si no se puede guardar, la próxima vez festeja de nuevo: no es grave
    }
  }

  function cerrar() {
    guardarVistos()
    setFestejo(null)
  }

  if (festejo === null) {
    return null
  }
  const { nivelNuevo, insigniasNuevas } = festejo
  const nivelInfo = NIVELES.find((n) => n.nombre === nivelNuevo)

  const confeti = []
  for (let i = 0; i < CANTIDAD_CONFETI; i++) {
    // Valores que varían con i, para que cada papelito caiga distinto
    confeti.push(
      <span
        key={i}
        className={`animate-confeti absolute -top-4 block h-3 w-2 rounded-xs ${COLORES_CONFETI[i % COLORES_CONFETI.length]}`}
        style={{
          left: `${(i * 37) % 100}%`,
          animationDelay: `${(i % 12) * 0.12}s`,
          animationDuration: `${2.4 + (i % 5) * 0.4}s`,
        }}
      />,
    )
  }

  return (
    <Dialog open onOpenChange={(abrir) => !abrir && cerrar()}>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-60 overflow-hidden motion-reduce:hidden"
      >
        {confeti}
      </div>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
        <div className="fondo-cancha text-primary-foreground relative flex flex-col items-center px-6 pt-9 pb-7 text-center">
          {/* Rayos de luz girando detrás del trofeo */}
          <span
            aria-hidden
            className="animate-girar absolute top-4 size-44 rounded-full opacity-40 motion-reduce:animate-none"
            style={{
              background:
                'repeating-conic-gradient(var(--highlight) 0deg 12deg, transparent 12deg 30deg)',
              maskImage: 'radial-gradient(circle, black 30%, transparent 70%)',
            }}
          />
          <span className="animate-trofeo bg-highlight text-highlight-foreground shadow-card relative flex size-20 items-center justify-center rounded-full motion-reduce:animate-none">
            {nivelNuevo ? <Trophy className="size-10" /> : <Award className="size-10" />}
          </span>

          <DialogTitle className="font-heading mt-5 text-3xl font-extrabold tracking-tight">
            {nivelNuevo ? `¡Subiste a ${nivelNuevo}!` : '¡Ganaste una insignia!'}
          </DialogTitle>
          <DialogDescription className="text-primary-foreground/85 mt-1.5 text-base">
            {nivelInfo && nivelInfo.descuento > 0
              ? `Ahora tenés ${nivelInfo.descuento}% de beneficio en cada reserva.`
              : 'Seguí jugando para sumar más.'}
          </DialogDescription>
        </div>

        <div className="space-y-4 px-6 pt-2 pb-6">
          {insigniasNuevas.length > 0 && (
            <div>
              <p className="text-muted-foreground text-sm font-semibold">
                {insigniasNuevas.length === 1 ? 'Insignia nueva' : 'Insignias nuevas'}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {insigniasNuevas.map((insignia, posicion) => (
                  <li
                    key={insignia.id}
                    className="animate-aparecer bg-highlight text-highlight-foreground rounded-full px-3 py-1 text-sm font-bold motion-reduce:animate-none"
                    style={{ animationDelay: `${0.4 + posicion * 0.15}s` }}
                  >
                    {insignia.nombre}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" render={<Link href="/perfil#insignias" />} onClick={cerrar}>
              Ver mis insignias
            </Button>
            <Button onClick={cerrar} autoFocus>
              ¡Vamos!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

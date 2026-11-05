'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import { Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputContrasenia } from '@/components/input-contrasenia'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LoginSuccess } from '@/components/login-success/login-success'
import { registerSchema } from '@/lib/validations/user'
import { homePorRol } from '@/lib/home-por-rol'

// Cada opción de "Soy": la elegida va en el verde oscuro, como las pestañas
const claseDeRol =
  'text-muted-foreground aria-pressed:bg-sidebar aria-pressed:text-sidebar-foreground h-9 flex-auto rounded-lg hover:bg-transparent sm:flex-1 aria-pressed:font-semibold'

export default function RegistroPage() {
  const [rol, setRol] = useState<'JUGADOR' | 'DUENIO'>('JUGADOR')
  const router = useRouter()
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [registroExitoso, setRegistroExitoso] = useState<{
    nombre: string
    destino: string
  } | null>(null)

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    const form = new FormData(e.currentTarget)

    if (form.get('confirmPassword') !== form.get('password')) {
      setError('Las contraseñas no coinciden.')
      return
    }

    const datos = {
      nombre: form.get('nombre'),
      email: form.get('email'),
      password: form.get('password'),
      rol: rol,
    }

    const parsed = registerSchema.safeParse(datos)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setCargando(true)
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })

    if (!res.ok) {
      const json = await res.json()
      setError(json.error)
      setCargando(false)
      return
    }

    const resultado = await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    })

    // Si por algo no se pudo abrir la sesión, lo mandamos al login a mano.
    if (resultado?.error) {
      router.push('/login?registrado=1')
      return
    }

    const session = await getSession()
    if (!session) {
      router.push('/login?registrado=1')
      return
    }

    setRegistroExitoso({
      nombre: session.user.name ?? '',
      destino: homePorRol(session.user.rol),
    })
  }

  if (registroExitoso) {
    return <LoginSuccess nombre={registroExitoso.nombre} destino={registroExitoso.destino} />
  }

  return (
    <div className="bg-card shadow-card w-full max-w-100 rounded-3xl p-6 sm:p-8">
      <h1 className="font-heading text-4xl font-bold tracking-tight">Creá tu cuenta</h1>
      <p className="text-muted-foreground mt-2 text-base">
        Para reservar canchas o publicar tu complejo.
      </p>

      {/* method="post": si se envía antes de que la página termine de cargar
          el JavaScript, el navegador lo manda solo. Con el GET por defecto la
          contraseña quedaba en la URL (y en el historial). */}
      <form method="post" className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label>Soy</Label>
          <ToggleGroup
            value={[rol]}
            onValueChange={(valores) => {
              if (valores[0]) setRol(valores[0] as 'JUGADOR' | 'DUENIO')
            }}
            spacing={1}
            className="bg-muted w-full rounded-xl p-1"
          >
            <ToggleGroupItem value="JUGADOR" className={claseDeRol}>
              Jugador
            </ToggleGroupItem>
            <ToggleGroupItem value="DUENIO" className={claseDeRol}>
              Dueño de complejo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nombre">Nombre</Label>
          <div className="relative">
            <User className="text-muted-foreground absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <Input id="nombre" name="nombre" placeholder="Juan Pérez" className="pl-11" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="juan@mail.com"
              className="pl-11"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <InputContrasenia id="password" name="password" placeholder="Mínimo 8 caracteres" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
          <InputContrasenia
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Repetí tu contraseña"
          />
        </div>

        {error && (
          <p className="bg-destructive/10 text-destructive rounded-xl px-3.5 py-2.5 text-sm font-medium">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={cargando}>
          {cargando ? 'Creando...' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="text-muted-foreground mt-5 text-center text-sm">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-primary font-semibold underline underline-offset-4">
          Iniciá sesión
        </Link>
      </p>
    </div>
  )
}

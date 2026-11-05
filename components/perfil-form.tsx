'use client'

import { useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Save, Trash2, Upload } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { iniciales } from '@/lib/iniciales'
import { avatarSchema, updateProfileSchema } from '@/lib/validations/user'

type UsuarioAEditar = {
  nombre: string
  email: string
  telefono: string | null
  dni: string | null
  imagenUrl: string | null
}

const claseInputConError = 'border-destructive ring-destructive/20 ring-3'

function ErrorDeCampo({ mensaje }: { mensaje?: string }) {
  if (!mensaje) {
    return null
  }
  return (
    <p className="text-destructive flex items-center gap-1 text-xs font-medium">
      <AlertCircle className="size-3.5" />
      {mensaje}
    </p>
  )
}

export function PerfilForm({ usuario, volverA }: { usuario: UsuarioAEditar; volverA: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)
  const [errorDeFoto, setErrorDeFoto] = useState('')
  const [cambiandoFoto, setCambiandoFoto] = useState(false)
  const [guardado, setGuardado] = useState(false)

  // La foto se sube sola, aparte del Guardar de los datos de texto
  async function subirFoto(event: ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0]
    if (!archivo) {
      return
    }
    setErrorDeFoto('')

    const parsed = avatarSchema.safeParse({ imagen: archivo })
    if (!parsed.success) {
      setErrorDeFoto(parsed.error.issues[0].message)
      event.target.value = ''
      return
    }

    setCambiandoFoto(true)
    const formData = new FormData()
    formData.append('imagen', archivo)
    const res = await fetch('/api/users/me/avatar', { method: 'POST', body: formData })
    if (!res.ok) {
      // Un 500 del server viene con el body vacío y res.json() rompe
      const json = await res.json().catch(() => ({ error: `error ${res.status} del servidor` }))
      setErrorDeFoto(json.error)
    }

    // Vaciar el input para que se pueda volver a elegir el mismo archivo
    event.target.value = ''
    setCambiandoFoto(false)
    router.refresh()
  }

  async function quitarFoto() {
    setErrorDeFoto('')
    setCambiandoFoto(true)
    const res = await fetch('/api/users/me/avatar', { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: `error ${res.status} del servidor` }))
      setErrorDeFoto(json.error)
    }
    setCambiandoFoto(false)
    router.refresh()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    setGuardado(false)

    const form = new FormData(e.currentTarget)
    const telefono = String(form.get('telefono')).trim()
    const dni = String(form.get('dni')).trim()
    const datos = {
      nombre: form.get('nombre'),
      email: form.get('email'),
      // campo vacío = el usuario no lo cargó
      telefono: telefono === '' ? null : telefono,
      dni: dni === '' ? null : dni,
    }

    const parsed = updateProfileSchema.safeParse(datos)
    if (!parsed.success) {
      const errores: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const campo = String(issue.path[0])
        if (!errores[campo]) {
          errores[campo] = issue.message
        }
      }
      setFieldErrors(errores)
      return
    }

    setCargando(true)
    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
    setCargando(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: `error ${res.status} del servidor` }))
      setError(json.error)
      return
    }
    setGuardado(true)
    router.refresh()
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {/* El título va acá (y no en la página) para que los botones queden en la
          misma línea: los dos dependen del estado del formulario */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-bold tracking-tight">Mi perfil</h1>
          <p className="text-muted-foreground mt-1">
            Cambiá tus datos y tu foto. Así te ven en TocaYJuga.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {guardado && <p className="text-muted-foreground text-sm">Cambios guardados.</p>}
          <Button type="button" variant="outline" render={<Link href={volverA} />}>
            Volver
          </Button>
          <Button type="submit" disabled={cargando}>
            {cargando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {cargando ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="bg-card shadow-card space-y-4 rounded-3xl p-6">
        <h2 className="font-heading text-xl font-bold">Foto de perfil</h2>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-20">
            <AvatarImage src={usuario.imagenUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-primary text-primary-foreground font-heading text-2xl font-bold">
              {iniciales(usuario.nombre)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={cambiandoFoto}
                render={<label htmlFor="foto-de-perfil" />}
              >
                {cambiandoFoto ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {usuario.imagenUrl ? 'Cambiar foto' : 'Subir foto'}
              </Button>
              {usuario.imagenUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={cambiandoFoto}
                  onClick={quitarFoto}
                >
                  <Trash2 className="size-4" />
                  Quitar foto
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              JPG, PNG o WebP de 4 MB como máximo. Si no cargás ninguna, mostramos las iniciales de
              tu nombre.
            </p>
            <ErrorDeCampo mensaje={errorDeFoto} />
          </div>

          <input
            id="foto-de-perfil"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={cambiandoFoto}
            className="hidden"
            onChange={subirFoto}
          />
        </div>
      </div>

      <div className="bg-card shadow-card grid grid-cols-1 gap-4 rounded-3xl p-6 sm:grid-cols-2">
        <h2 className="font-heading text-xl font-bold sm:col-span-2">Tus datos</h2>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nombre">Nombre y apellido</Label>
          <Input
            id="nombre"
            name="nombre"
            placeholder="Ej: Juan Pérez"
            defaultValue={usuario.nombre}
            aria-invalid={!!fieldErrors.nombre}
            className={fieldErrors.nombre ? claseInputConError : undefined}
          />
          <ErrorDeCampo mensaje={fieldErrors.nombre} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Ej: juan@mail.com"
            defaultValue={usuario.email}
            aria-invalid={!!fieldErrors.email}
            className={fieldErrors.email ? claseInputConError : undefined}
          />
          <p className="text-muted-foreground text-xs">Con este email entrás a tu cuenta.</p>
          <ErrorDeCampo mensaje={fieldErrors.email} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="telefono">Teléfono (opcional)</Label>
          <Input
            id="telefono"
            name="telefono"
            type="tel"
            placeholder="Ej: 11 4589-2231"
            defaultValue={usuario.telefono ?? ''}
            aria-invalid={!!fieldErrors.telefono}
            className={fieldErrors.telefono ? claseInputConError : undefined}
          />
          <ErrorDeCampo mensaje={fieldErrors.telefono} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dni">DNI (opcional)</Label>
          <Input
            id="dni"
            name="dni"
            placeholder="Ej: 38124567"
            defaultValue={usuario.dni ?? ''}
            aria-invalid={!!fieldErrors.dni}
            className={fieldErrors.dni ? claseInputConError : undefined}
          />
          <ErrorDeCampo mensaje={fieldErrors.dni} />
        </div>
      </div>
    </form>
  )
}

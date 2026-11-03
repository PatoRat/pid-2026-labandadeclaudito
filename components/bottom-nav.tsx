'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { navPorRol, esElItemActivo } from '@/lib/nav'
import { homePorRol } from '@/lib/home-por-rol'
import { rolLabels } from '@/lib/labels'
import { iniciales } from '@/lib/iniciales'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { SignOutButton } from '@/components/sign-out-button'

// Barra de navegación fija en el borde inferior, para formato vertical (portrait).
// Reemplaza al sidebar (que se desmonta en vertical, ver app-sidebar.tsx). Se
// oculta en horizontal por CSS para no hacer flash: se renderiza siempre pero
// landscape:hidden la esconde cuando la pantalla es más ancha que alta.
export function BottomNav({
  rol,
  nombre,
  email,
  imagenUrl,
}: {
  rol: 'JUGADOR' | 'DUENIO' | 'ADMIN'
  nombre: string
  email: string
  imagenUrl: string | null
}) {
  const pathname = usePathname()
  const items = navPorRol[rol]
  const home = homePorRol(rol)

  return (
    <nav className="bg-sidebar text-sidebar-foreground fixed inset-x-0 bottom-0 z-40 flex items-stretch rounded-t-3xl pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.15)] landscape:hidden">
      {items.map((item) => {
        const activo = esElItemActivo(item.href, pathname, home)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs [&_svg]:size-5 ' +
              (activo ? 'text-sidebar-primary font-semibold' : 'text-sidebar-foreground/70')
            }
          >
            <item.icon />
            <span>{item.labelCorto ?? item.label}</span>
          </Link>
        )
      })}

      {/* Tab extra "Cuenta": abre el panel con perfil, tema y cerrar sesión. */}
      <Sheet>
        <SheetTrigger className="text-sidebar-foreground/70 flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs [&_svg]:size-5">
          <UserRound />
          <span>Cuenta</span>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="bg-sidebar text-sidebar-foreground border-sidebar-border rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle className="text-sidebar-foreground">Cuenta</SheetTitle>
          </SheetHeader>
          {/* Mismo bloque que el footer del sidebar (app-sidebar.tsx). */}
          <div className="bg-sidebar-accent mx-4 mb-6 space-y-2 rounded-2xl p-2.5">
            <div className="flex items-center gap-2.5">
              {rol === 'ADMIN' ? (
                // El admin es una cuenta de la app: no tiene perfil que editar
                <div className="flex min-w-0 flex-1 items-center gap-2.5" title={email}>
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={imagenUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold">
                      {iniciales(nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{nombre}</p>
                    <p className="text-sidebar-foreground/60 truncate text-xs">{rolLabels[rol]}</p>
                  </div>
                </div>
              ) : (
                <SheetClose
                  render={
                    <Link
                      href="/perfil"
                      title="Editar mi perfil"
                      className="hover:bg-sidebar-accent flex min-w-0 flex-1 items-center gap-2.5 rounded-xl transition-colors"
                    />
                  }
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarImage src={imagenUrl ?? undefined} alt="" />
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold">
                      {iniciales(nombre)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{nombre}</p>
                    <p className="text-sidebar-foreground/60 truncate text-xs">{rolLabels[rol]}</p>
                  </div>
                </SheetClose>
              )}
              <ThemeToggle />
            </div>
            <SignOutButton />
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}

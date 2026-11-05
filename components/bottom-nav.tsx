'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { navPorRol, esElItemActivo, type ItemNav } from '@/lib/nav'
import { cn } from '@/lib/utils'
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
// Inicio va en el medio, en un círculo destacado: es a donde se llega al entrar.
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
  const home = homePorRol(rol)

  // Inicio va aparte, en el círculo del medio. El resto se reparte a los dos
  // lados: la mitad a la izquierda y la otra mitad (más "Cuenta") a la derecha.
  const inicio = navPorRol[rol].find((item) => item.href === home)
  const otros = navPorRol[rol].filter((item) => item.href !== home)
  const cantidadALaIzquierda = Math.ceil((otros.length + 1) / 2)
  const izquierda = otros.slice(0, cantidadALaIzquierda)
  const derecha = otros.slice(cantidadALaIzquierda)
  const inicioActivo = pathname === home

  return (
    <nav className="bg-sidebar text-sidebar-foreground fixed inset-x-0 bottom-0 z-40 rounded-t-3xl pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.15)] landscape:hidden">
      <div className="flex h-16 items-stretch px-1">
        {izquierda.map((item) => (
          <Pestania
            key={item.href}
            item={item}
            activo={esElItemActivo(item.href, pathname, home)}
          />
        ))}

        {/* Inicio: un círculo que sobresale de la barra. El anillo del color
            del fondo de la página hace de "muesca" entre el círculo y la barra */}
        {inicio && (
          <div className="flex flex-1 justify-center">
            <Link
              href={inicio.href}
              aria-label={inicio.label}
              aria-current={inicioActivo ? 'page' : undefined}
              className={cn(
                'ring-background shadow-button -mt-6 flex size-15 items-center justify-center rounded-full ring-4 transition-transform active:scale-90',
                inicioActivo
                  ? 'bg-highlight text-highlight-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              <inicio.icon className="size-6.5" />
            </Link>
          </div>
        )}

        {derecha.map((item) => (
          <Pestania
            key={item.href}
            item={item}
            activo={esElItemActivo(item.href, pathname, home)}
          />
        ))}

        {/* Pestaña extra "Cuenta": abre el panel con perfil, tema y cerrar sesión. */}
        <Sheet>
          <SheetTrigger className={clasesDePestania(pathname === '/perfil')}>
            <IconoDePestania activo={pathname === '/perfil'}>
              <UserRound />
            </IconoDePestania>
            <span className="max-w-full truncate">Cuenta</span>
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
                      <p className="text-sidebar-foreground/60 truncate text-xs">
                        {rolLabels[rol]}
                      </p>
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
                      <p className="text-sidebar-foreground/60 truncate text-xs">
                        {rolLabels[rol]}
                      </p>
                    </div>
                  </SheetClose>
                )}
                <ThemeToggle />
              </div>
              <SignOutButton />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}

// Las pestañas comunes: ícono arriba y texto abajo. La activa lleva el ícono
// dentro de una pastilla, así se distingue sin depender solo del color.
function clasesDePestania(activo: boolean) {
  return cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px]',
    activo ? 'text-sidebar-foreground font-semibold' : 'text-sidebar-foreground/60',
  )
}

function IconoDePestania({ activo, children }: { activo: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'flex h-7 w-12 items-center justify-center rounded-full transition-colors [&_svg]:size-5',
        activo && 'bg-sidebar-accent text-sidebar-primary',
      )}
    >
      {children}
    </span>
  )
}

function Pestania({ item, activo }: { item: ItemNav; activo: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={activo ? 'page' : undefined}
      className={clasesDePestania(activo)}
    >
      <IconoDePestania activo={activo}>
        <item.icon />
      </IconoDePestania>
      <span className="max-w-full truncate">{item.labelCorto ?? item.label}</span>
    </Link>
  )
}

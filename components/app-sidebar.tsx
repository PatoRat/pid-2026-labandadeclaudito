'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Equal, X } from 'lucide-react'
import { navPorRol, esElItemActivo } from '@/lib/nav'
import { useIsPortrait } from '@/hooks/use-portrait'
import { homePorRol } from '@/lib/home-por-rol'
import { rolLabels } from '@/lib/labels'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { iniciales } from '@/lib/iniciales'
import { SignOutButton } from '@/components/sign-out-button'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

// Botón de la barra de arriba en mobile para abrir el sidebar (dos líneas)
export function MobileMenuButton() {
  const { setOpenMobile } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Abrir menú"
      onClick={() => setOpenMobile(true)}
    >
      <Equal className="size-5" />
    </Button>
  )
}

export function AppSidebar({
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
  // En mobile el sidebar es un panel encima de la página: lo cerramos al navegar
  const { isMobile, setOpenMobile } = useSidebar()
  const portrait = useIsPortrait()
  const items = navPorRol[rol]
  const home = homePorRol(rol)

  // En formato vertical no hay sidebar: la navegación va en la barra inferior
  // (components/bottom-nav.tsx). Lo desmontamos para que no reserve ancho.
  if (portrait) return null

  return (
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0">
      <SidebarHeader className="h-16 justify-center px-2 py-0">
        {/* Sidebar abierto: logo y nombre a la izquierda, y a la derecha el botón
            de plegar (desktop) o una cruz para cerrar (mobile).
            pl-2 alinea el logo con los íconos del nav: el contenido de abajo
            suma el p-2 del SidebarContent, del SidebarGroup y del botón. */}
        <div className="flex items-center justify-between pl-2 group-data-[collapsible=icon]:hidden">
          <Link
            href={home}
            className="flex items-center gap-2"
            onClick={() => setOpenMobile(false)}
          >
            <Logo className="size-8" sobreFondoOscuro />
            <span className="font-brand text-xl font-extrabold tracking-tight">
              Toca<span className="text-sidebar-primary">Y</span>Juga
            </span>
          </Link>
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cerrar menú"
              onClick={() => setOpenMobile(false)}
            >
              <X />
            </Button>
          ) : (
            <SidebarTrigger />
          )}
        </div>

        {/* Sidebar plegado: se ve el logo, y al pasar el mouse por encima
            aparece en su lugar el botón para volver a abrirlo. */}
        <div className="group/logo relative mx-auto hidden size-8 group-data-[collapsible=icon]:block">
          <Link
            href={home}
            className="flex size-8 items-center justify-center transition-opacity group-hover/logo:opacity-0"
          >
            <Logo className="size-8" sobreFondoOscuro />
          </Link>
          <SidebarTrigger className="absolute inset-0 size-8 opacity-0 transition-opacity group-hover/logo:opacity-100" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                    isActive={esElItemActivo(item.href, pathname, home)}
                    tooltip={item.label}
                    className="text-sidebar-foreground/80 data-active:[&_svg]:text-sidebar-primary h-11 gap-3 px-3.5 text-base [&_svg]:size-5 group-data-[collapsible=icon]:p-1.5!"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Tarjeta del perfil: avatar, nombre, cerrar sesión y tema. Con el
            sidebar plegado queda solo el avatar con el botón de tema abajo.
            El botón de cerrar sesión va afuera del link: un <button> no puede
            ir adentro de un <a>. */}
        <div className="bg-sidebar-accent space-y-2 rounded-2xl p-2.5 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:flex-col">
            {rol === 'ADMIN' ? (
              // El admin es una cuenta de la app: no tiene perfil que editar
              <div className="flex min-w-0 flex-1 items-center gap-2.5" title={email}>
                <Avatar className="size-9 shrink-0 group-data-[collapsible=icon]:size-8">
                  <AvatarImage src={imagenUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold">
                    {iniciales(nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold">{nombre}</p>
                  <p className="text-sidebar-foreground/60 truncate text-xs">{rolLabels[rol]}</p>
                </div>
              </div>
            ) : (
              <Link
                href="/perfil"
                onClick={() => setOpenMobile(false)}
                title="Editar mi perfil"
                className="hover:bg-sidebar-accent flex min-w-0 flex-1 items-center gap-2.5 rounded-xl transition-colors"
              >
                <Avatar className="size-9 shrink-0 group-data-[collapsible=icon]:size-8">
                  <AvatarImage src={imagenUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-heading font-bold">
                    {iniciales(nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-semibold">{nombre}</p>
                  <p className="text-sidebar-foreground/60 truncate text-xs">{rolLabels[rol]}</p>
                </div>
              </Link>
            )}
            <ThemeToggle />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <SignOutButton />
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

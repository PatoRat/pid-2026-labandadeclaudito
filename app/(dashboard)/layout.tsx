import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { AppSidebar, MobileMenuButton } from '@/components/app-sidebar'
import { BottomNav } from '@/components/bottom-nav'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  const session = await auth()

  // el proxy ya protege /jugador y /dueno, pero si por algo llega acá
  // sin sesión no queremos romper leyendo session.user de undefined
  if (!session) redirect('/login')

  // El nombre y la foto se leen de la base, no de la sesión: el token solo
  // refresca el rol, así que después de editar el perfil la sesión los
  // seguiría mostrando viejos hasta volver a entrar.
  const usuario = await db.usuario.findUnique({
    where: { id: session.user.id },
    select: { nombre: true, email: true, imagenUrl: true },
  })
  if (!usuario) redirect('/login')

  return (
    <TooltipProvider>
      {/* El fondo de todo es el verde del sidebar y el contenido es una hoja
          clara con las esquinas izquierdas redondeadas apoyada encima: así el
          sidebar no queda como un rectángulo cortado contra la página. */}
      <SidebarProvider className="bg-sidebar">
        <AppSidebar
          rol={session.user.rol}
          nombre={usuario.nombre}
          email={usuario.email}
          imagenUrl={usuario.imagenUrl}
        />
        {/* Desde md la hoja ocupa el alto de la pantalla y scrollea por dentro,
            para que las esquinas redondeadas no se vayan al scrollear. En
            vertical no hay sidebar verde al lado, así que no se redondea. */}
        <SidebarInset className="md:h-svh md:overflow-y-auto md:rounded-l-3xl portrait:rounded-none">
          {/* En mobile el sidebar se esconde y esta barra tiene el botón para
              abrirlo. En vertical lo reemplaza la barra inferior, así que se
              oculta (queda solo para landscape angosto). */}
          <header className="border-border flex h-14 items-center border-b px-4 md:hidden portrait:hidden">
            <MobileMenuButton />
          </header>
          {/* Ancho y márgenes de todas las páginas del dashboard: ocupan todo
              el ancho hasta 1536px y, en pantallas más grandes, se centran.
              Las páginas no ponen su propio max-w ni padding. En vertical se
              suma pb para que la barra inferior no tape el contenido. */}
          <div className="mx-auto w-full max-w-(--breakpoint-2xl) px-6 pt-7 pb-12 lg:px-10 portrait:pb-28">
            {children}
          </div>
        </SidebarInset>
        {/* Navegación de formato vertical (se oculta sola en horizontal) */}
        <BottomNav
          rol={session.user.rol}
          nombre={usuario.nombre}
          email={usuario.email}
          imagenUrl={usuario.imagenUrl}
        />
      </SidebarProvider>
    </TooltipProvider>
  )
}

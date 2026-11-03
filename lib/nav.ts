import {
  Building2,
  CalendarDays,
  ChartColumn,
  Home,
  Scale,
  Search,
  Trophy,
  Users,
} from 'lucide-react'

// Navegación de las páginas con sesión, compartida entre el sidebar
// (components/app-sidebar.tsx) y la barra inferior (components/bottom-nav.tsx).

export type ItemNav = {
  href: string
  label: string
  // Para la barra inferior, donde con 5 pestañas un texto largo ocupa 2 renglones
  labelCorto?: string
  icon: typeof Home
}

export const navPorRol: Record<'JUGADOR' | 'DUENIO' | 'ADMIN', ItemNav[]> = {
  JUGADOR: [
    { href: '/jugador', label: 'Inicio', icon: Home },
    { href: '/jugador/canchas', label: 'Buscar canchas', labelCorto: 'Buscar', icon: Search },
    { href: '/jugador/reservas', label: 'Mis reservas', icon: CalendarDays },
    { href: '/jugador/ranking', label: 'Ranking', icon: Trophy },
  ],
  DUENIO: [
    { href: '/dueno', label: 'Inicio', icon: Home },
    { href: '/dueno/complejos', label: 'Mis complejos', icon: Building2 },
    { href: '/dueno/reservas', label: 'Reservas', icon: CalendarDays },
    { href: '/dueno/dashboard', label: 'Estadísticas', icon: ChartColumn },
  ],
  ADMIN: [
    { href: '/admin', label: 'Inicio', icon: Home },
    { href: '/admin/usuarios', label: 'Usuarios', icon: Users },
    { href: '/admin/complejos', label: 'Complejos', icon: Building2 },
    { href: '/admin/reservas', label: 'Reservas', icon: CalendarDays },
    { href: '/admin/disputas', label: 'Disputas', icon: Scale },
  ],
}

// El Inicio de cada rol es prefijo de todas sus páginas (/admin lo es de
// /admin/usuarios), así que ese se compara exacto; el resto se ilumina también
// en sus subrutas (/admin/disputas/[id], /dueno/complejos/[id]/canchas).
export function esElItemActivo(href: string, pathname: string, home: string): boolean {
  if (href === home) return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}
